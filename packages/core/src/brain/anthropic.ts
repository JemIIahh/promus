/**
 * Anthropic (Claude) brain — the EVM-agnostic replacement for the 0G Compute
 * brain. Same Brain contract (per-channel history, internal tool loop,
 * pre-flight compaction, optional persist), but inference goes to the Claude
 * Messages API instead of a 0G provider, so there is no on-chain ledger /
 * broker / provider catalog. The API key is read from ANTHROPIC_API_KEY (never
 * stored in config or the repo).
 *
 * Design notes:
 *  - `thinking` is intentionally omitted. anima's BrainMessage can't carry
 *    Claude thinking blocks, and extended/adaptive thinking + tool use requires
 *    round-tripping those blocks. Opus 4.8 runs fine without an explicit
 *    `thinking` field; we lean on the model's native capability instead.
 *  - Tool results for one assistant turn are grouped into a single user turn of
 *    `tool_result` blocks, as the Messages API expects.
 */
import Anthropic from '@anthropic-ai/sdk'
import { sanitizeToolName } from '../tools/sanitize'
import type { ToolSchema } from '../tools/types'
import {
  type CompactionOpts,
  DEFAULT_COMPACTION_OPTS,
  SUMMARY_SYSTEM_PROMPT,
  compactHistory,
  shouldCompact,
} from './compaction'
import { type FrozenPrefix, renderFrozenPrefix, renderUserContext } from './frozen-prefix'
import type { HistoryPersist } from './history-persist'
import { sanitizeDashes } from './sanitize'
import type { Brain, BrainInferInput, BrainMessage, BrainTurn } from './types'

export const DEFAULT_CHANNEL_KEY = 'default'
export const DEFAULT_MAX_OUTPUT_TOKENS = 4096
/** Current most-capable Claude model; override via opts.model / ANTHROPIC_MODEL. */
export const DEFAULT_ANTHROPIC_MODEL = 'claude-opus-4-8'

export interface AnthropicBrainOpts {
  /** API key. Defaults to process.env.ANTHROPIC_API_KEY. */
  apiKey?: string
  /** Model id. Defaults to ANTHROPIC_MODEL env, else DEFAULT_ANTHROPIC_MODEL. */
  model?: string | null
  tools: ToolSchema[]
  prefix: FrozenPrefix
  history?: BrainMessage[]
  maxOutputTokens?: number
  compaction?: CompactionOpts | null
  persist?: HistoryPersist
  onToolCall?: (call: { id: string; name: string; args: unknown }) => Promise<BrainMessage>
}

export class AnthropicBrain implements Brain {
  private client: Anthropic | null = null
  private readonly model: string
  private readonly histories = new Map<string, BrainMessage[]>()
  private readonly lastUsage = new Map<string, BrainTurn['usage']>()
  private readonly renderedPrefix: string
  private userContextText: string | null
  private persistHydrated = false

  constructor(private readonly opts: AnthropicBrainOpts) {
    if (opts.history && opts.history.length > 0) {
      this.histories.set(DEFAULT_CHANNEL_KEY, [...opts.history])
    }
    // Use `||` (not `??`) and trim so an empty/whitespace model string — which
    // is what `config.brain.model` and an unset `ANTHROPIC_MODEL=` both produce —
    // falls through to the default instead of being sent to the API verbatim
    // (the API rejects an empty model with "String should have at least 1 character").
    this.model =
      opts.model?.trim() || process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL
    this.renderedPrefix = renderFrozenPrefix(opts.prefix)
    this.userContextText = renderUserContext(opts.prefix)
  }

  refreshUserContext(prefix: FrozenPrefix): void {
    this.userContextText = renderUserContext(prefix)
  }

  async init(): Promise<void> {
    if (this.client) return
    const apiKey = this.opts.apiKey ?? process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY is not set. Add it to your environment (.env) — the Anthropic brain reads the key from the environment, never from config.',
      )
    }
    this.client = new Anthropic({ apiKey })
    await this.hydrateFromPersist()
  }

  private async hydrateFromPersist(): Promise<void> {
    if (this.persistHydrated || !this.opts.persist) return
    this.persistHydrated = true
    try {
      const loaded = await this.opts.persist.loadAll()
      for (const [key, history] of loaded) {
        if (this.histories.has(key) && (this.histories.get(key)?.length ?? 0) > 0) continue
        this.histories.set(key, [...history])
      }
    } catch {
      /* persist load failures must never block startup */
    }
  }

  getChannelHistory(channelKey: string = DEFAULT_CHANNEL_KEY): readonly BrainMessage[] {
    return [...(this.histories.get(channelKey) ?? [])]
  }

  setChannelHistory(channelKey: string, history: BrainMessage[]): void {
    this.histories.set(channelKey, [...history])
  }

  async clearChannel(channelKey: string = DEFAULT_CHANNEL_KEY): Promise<void> {
    this.histories.set(channelKey, [])
    this.lastUsage.delete(channelKey)
    if (this.opts.persist) {
      try {
        await this.opts.persist.clearChannel(channelKey)
      } catch {
        /* best-effort */
      }
    }
  }

  listChannels(): string[] {
    const out: string[] = []
    for (const [k, v] of this.histories) {
      if (v.length > 0) out.push(k)
    }
    return out
  }

  private getOrCreateHistory(channelKey: string): BrainMessage[] {
    let h = this.histories.get(channelKey)
    if (!h) {
      h = []
      this.histories.set(channelKey, h)
    }
    return h
  }

  async infer(input: BrainInferInput): Promise<BrainTurn> {
    if (!this.client) await this.init()
    const signal = input.signal
    if (signal?.aborted) throw new DOMException('aborted before infer started', 'AbortError')

    const channelKey = input.channelKey ?? DEFAULT_CHANNEL_KEY
    await this.maybeCompact(channelKey, input)

    const history = this.getOrCreateHistory(channelKey)
    const userText = normalizeUserContent(input)
    const messages: BrainMessage[] = [{ role: 'system', content: this.renderedPrefix }, ...history]
    if (this.userContextText) messages.push({ role: 'user', content: this.userContextText })
    messages.push({ role: 'user', content: userText })

    let turnResult: BrainTurn | null = null
    // No round-trip cap — the loop exits when the model returns a tool-free
    // response (its final answer).
    while (true) {
      if (signal?.aborted) throw new DOMException('aborted between round-trips', 'AbortError')
      const resp = await this.callCompletion(messages, signal)
      turnResult = resp

      if (!resp.toolCalls.length) {
        messages.push({ role: 'assistant', content: resp.content ?? '' })
        break
      }

      messages.push({ role: 'assistant', content: resp.content ?? '', toolCalls: resp.toolCalls })
      for (const call of resp.toolCalls) {
        if (signal?.aborted) throw new DOMException('aborted between tool calls', 'AbortError')
        if (!this.opts.onToolCall) {
          messages.push({
            role: 'tool',
            toolCallId: call.id,
            content: JSON.stringify({ error: 'Tool handler not wired' }),
          })
          continue
        }
        if (input.onToolEvent) {
          try {
            input.onToolEvent({
              kind: 'start',
              tool: call.name,
              callId: call.id,
              argsPreview: previewToolArgs(call.args),
            })
          } catch {
            /* observer errors must never block tool execution */
          }
        }
        const toolMsg = await this.opts.onToolCall(call)
        if (input.onToolEvent) {
          try {
            input.onToolEvent({
              kind: 'end',
              tool: call.name,
              callId: call.id,
              ok: inferToolOk(toolMsg.content ?? ''),
            })
          } catch {
            /* swallow */
          }
        }
        messages.push({ ...toolMsg, toolCallId: call.id })
      }
    }

    const finalAssistant = findLastAssistantContent(messages)
    const userMsg: BrainMessage = { role: 'user', content: userText }
    const assistantMsg: BrainMessage = { role: 'assistant', content: finalAssistant }
    history.push(userMsg)
    history.push(assistantMsg)

    if (turnResult?.usage) this.lastUsage.set(channelKey, turnResult.usage)
    if (this.opts.persist) {
      try {
        await this.opts.persist.appendTurn(channelKey, userMsg, assistantMsg)
      } catch {
        /* non-fatal */
      }
    }
    if (turnResult?.content) turnResult.content = sanitizeDashes(turnResult.content)
    return turnResult ?? { content: null, toolCalls: [] }
  }

  private async maybeCompact(channelKey: string, input: BrainInferInput): Promise<void> {
    if (this.opts.compaction === null) return
    const cfg = this.opts.compaction ?? DEFAULT_COMPACTION_OPTS
    const history = this.histories.get(channelKey)
    if (!history || history.length === 0) return
    const lastUsage = this.lastUsage.get(channelKey)
    const trigger = shouldCompact(history, lastUsage?.promptTokens ?? null, cfg)
    if (trigger == null) return
    let compacted: BrainMessage[]
    try {
      compacted = await compactHistory(history, cfg, async older => this.summarizeOlder(older))
    } catch {
      return
    }
    if (compacted.length >= history.length) return
    this.histories.set(channelKey, compacted)
    this.lastUsage.delete(channelKey)
    if (this.opts.persist) {
      try {
        await this.opts.persist.rewriteChannel(channelKey, compacted)
      } catch {
        /* best-effort */
      }
    }
    if (input.onCompactionEvent) {
      try {
        input.onCompactionEvent({ channelKey, from: history.length, to: compacted.length, promptTokens: trigger })
      } catch {
        /* swallowed */
      }
    }
  }

  private async summarizeOlder(older: readonly BrainMessage[]): Promise<string> {
    if (!this.client) throw new Error('Brain not initialized; call init() first.')
    const flat = older
      .map(m => {
        const tag = m.role.toUpperCase()
        if (m.toolCalls && m.toolCalls.length > 0) {
          const calls = m.toolCalls
            .map(tc => `${tc.name}(${typeof tc.args === 'string' ? tc.args : JSON.stringify(tc.args ?? {})})`)
            .join(' | ')
          return `${tag}: ${m.content || ''}\n[TOOL_CALLS] ${calls}`
        }
        return `${tag}: ${m.content || ''}`
      })
      .join('\n\n')
    const resp = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: SUMMARY_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: flat }],
    })
    return extractText(resp.content).trim()
  }

  private async callCompletion(messages: BrainMessage[], signal?: AbortSignal): Promise<BrainTurn> {
    if (!this.client) throw new Error('Brain not initialized; call init() first.')

    // The frozen prefix (and any other system rows) become the top-level
    // `system` param; the rest become the alternating user/assistant transcript.
    const systemText = messages
      .filter(m => m.role === 'system')
      .map(m => m.content)
      .join('\n\n')
    const convo = toAnthropicMessages(messages.filter(m => m.role !== 'system'))

    // Anthropic tool names must match ^[a-zA-Z0-9_-]{1,128}$ (no dots); anima
    // tools are `namespace.method` (memory.save). Sanitize for the API and keep
    // a reverse map so tool_use names in the response map back to real names.
    const toolNameMap = new Map<string, string>() // sanitized -> original
    const tools: Anthropic.Tool[] = this.opts.tools.map(t => {
      const apiName = sanitizeToolName(t.function.name)
      toolNameMap.set(apiName, t.function.name)
      return {
        name: apiName,
        description: t.function.description,
        input_schema: t.function.parameters as Anthropic.Tool.InputSchema,
      }
    })

    const resp = await this.client.messages.create(
      {
        model: this.model,
        max_tokens: this.opts.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
        ...(systemText ? { system: systemText } : {}),
        messages: convo,
        ...(tools.length > 0 ? { tools } : {}),
      },
      signal ? { signal } : undefined,
    )

    const toolCalls = resp.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      .map(b => ({ id: b.id, name: toolNameMap.get(b.name) ?? b.name, args: b.input }))

    return {
      content: extractText(resp.content) || null,
      toolCalls,
      finishReason: resp.stop_reason ?? undefined,
      usage: {
        promptTokens: resp.usage.input_tokens,
        completionTokens: resp.usage.output_tokens,
        totalTokens: resp.usage.input_tokens + resp.usage.output_tokens,
        cachedTokens: resp.usage.cache_read_input_tokens ?? undefined,
      },
    }
  }
}

/**
 * Map anima's BrainMessage[] into Anthropic MessageParam[]. assistant tool
 * calls become `tool_use` content blocks; `tool` rows become `tool_result`
 * blocks in a user turn. Consecutive tool results are grouped into a single
 * user message, as the Messages API expects after one assistant tool turn.
 */
function toAnthropicMessages(rows: BrainMessage[]): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = []
  for (const m of rows) {
    if (m.role === 'tool') {
      const block: Anthropic.ToolResultBlockParam = {
        type: 'tool_result',
        tool_use_id: m.toolCallId ?? '',
        content: m.content,
      }
      const prev = out.at(-1)
      // Coalesce adjacent tool results into the trailing user turn.
      if (prev && prev.role === 'user' && Array.isArray(prev.content)) {
        ;(prev.content as Anthropic.ContentBlockParam[]).push(block)
      } else {
        out.push({ role: 'user', content: [block] })
      }
      continue
    }
    if (m.role === 'assistant') {
      const blocks: Anthropic.ContentBlockParam[] = []
      if (m.content) blocks.push({ type: 'text', text: m.content })
      if (m.toolCalls) {
        for (const tc of m.toolCalls) {
          blocks.push({
            type: 'tool_use',
            id: tc.id,
            name: sanitizeToolName(tc.name),
            input: (typeof tc.args === 'string' ? safeParseJson(tc.args) : tc.args) ?? {},
          })
        }
      }
      // An assistant turn must be non-empty; fall back to a single space.
      out.push({ role: 'assistant', content: blocks.length > 0 ? blocks : ' ' })
      continue
    }
    // user
    out.push({ role: 'user', content: m.content })
  }
  return out
}

function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')
}

function normalizeUserContent(input: BrainInferInput): string {
  const d = input.event.payload.data
  return typeof d === 'string' ? d : JSON.stringify(d)
}

function safeParseJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return raw
  }
}

function findLastAssistantContent(messages: BrainMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m && m.role === 'assistant') return m.content
  }
  return ''
}

export function previewToolArgs(args: unknown): string {
  if (args == null) return ''
  if (typeof args === 'string') return truncatePreview(args)
  if (Array.isArray(args)) return `[${args.length}]`
  if (typeof args === 'object') {
    const o = args as Record<string, unknown>
    const keys = Object.keys(o)
    if (keys.length === 0) return ''
    for (const k of ['url', 'path', 'command', 'query', 'name', 'address']) {
      const v = o[k]
      if (typeof v === 'string' && v.length > 0) return truncatePreview(`${k}=${v}`)
    }
    return truncatePreview(keys.join(','))
  }
  try {
    return truncatePreview(String(args))
  } catch {
    return ''
  }
}

function truncatePreview(s: string): string {
  const max = 60
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`
}

export function inferToolOk(content: string): boolean {
  if (!content) return true
  try {
    const o = JSON.parse(content) as Record<string, unknown>
    if (typeof o.ok === 'boolean') return o.ok
    if (typeof o.error === 'string' && o.error.length > 0) return false
    return true
  } catch {
    return !content.toLowerCase().includes('error')
  }
}
