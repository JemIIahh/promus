import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { NextRequest } from 'next/server'
import { type Doc, getDoc, listDocs, listSlugs } from '@/lib/docs'

export const runtime = 'nodejs'
export const dynamic = 'force-static'

export async function generateStaticParams() {
  const slugs = await listSlugs()
  return [
    { path: [] },
    { path: ['full'] },
    ...slugs.map(slug => ({ path: ['docs', slug] })),
  ]
}

// TODO: real domain — promus.dev is a placeholder; the domain is not yet owned.
const SITE_ORIGIN = 'https://promus.dev'
const REPO_BASE = 'https://github.com/JemIIahh/promus/blob/main/'

const TEXT_HEADERS = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
  'X-Promus-Source': 'docs-llms',
}

const FULL_ORDER = [
  'agents',
  'quickstart',
  'configuration',
  'cli',
  'brain',
  'tools',
  'memory',
  'architecture',
  'identity',
  'introduction',
]

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  const { path: parts = [] } = await context.params

  if (parts.length === 0) {
    return text(await renderLlmsIndex())
  }
  if (parts.length === 1 && parts[0] === 'full') {
    return text(await renderLlmsFull())
  }
  if (parts.length === 2 && parts[0] === 'docs') {
    const body = await renderDocRaw(parts[1])
    if (body === null) return notFound()
    return text(body)
  }
  return notFound()
}

function text(body: string): Response {
  return new Response(body, { status: 200, headers: TEXT_HEADERS })
}

function notFound(): Response {
  return new Response('not found\n', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

async function renderLlmsIndex(): Promise<string> {
  const docs = await listDocs()
  const docBullets = docs
    .map(
      d =>
        `- [${d.frontmatter.title}](${SITE_ORIGIN}/docs/${d.frontmatter.slug}.md): ${d.frontmatter.description}`,
    )
    .join('\n')

  return `# Promus

> Sovereign AI agents on Arbitrum. A CLI-hosted agent runtime whose identity is an ERC-7857 iNFT on Arbitrum, memory is encrypted on IPFS, brain is Claude (Anthropic), and wallet is sealed to the iNFT operator. Operator runs \`promus init\` once; the agent persists on chain and survives the operator.

## Install

bun is REQUIRED. The CLI shebangs \`#!/usr/bin/env bun\`. \`npm install -g\` puts the binary on PATH but it exits at runtime without bun.

\`\`\`
curl -fsSL https://bun.sh/install | bash
bun add -g promus
promus init
\`\`\`

Requires bun >=1.1. Published as \`promus\` on npm; the binary is \`promus\`. Set \`ANTHROPIC_API_KEY\` (the brain) and point \`ANIMA_IPFS_API_URL\` at a Kubo node (the memory backend) before \`promus init\`.

## For AI agents

\`promus init\` is interactive (blocking prompts; no full env-var bypass). Two paths: guide the human through the wizard, OR puppet the TUI via \`tmux send-keys\` if you have shell access (Claude Code, Codex). Naive \`echo y | promus init\` will hang. Full install model, anti-patterns, common errors, state layout: ${SITE_ORIGIN}/docs/agents.md

- Full single-file dump: ${SITE_ORIGIN}/llms-full.txt
- Per-page raw markdown: ${SITE_ORIGIN}/docs/<slug>.md (e.g. ${SITE_ORIGIN}/docs/quickstart.md)

## Docs

${docBullets}

## Reference

- README: https://github.com/JemIIahh/promus#readme
- Releases: https://github.com/JemIIahh/promus/releases
- Networks: Arbitrum Sepolia chainId 421614 (https://sepolia-rollup.arbitrum.io/rpc), Robinhood Chain testnet chainId 46630 (https://rpc.testnet.chain.robinhood.com)
- PromusAgentNFT (ERC-7857): 0x74F838421A2dA38C20Fe9Fd5E87C8FA5c053DDa3 (same address on both chains via CREATE2)
- PromusInbox: 0xF937b333978fd8B9A6798b90F5ce8C93e365540b
- PromusMarket: 0x37909ccF38303acc0538be61F4e38b8dB18D0685
`
}

async function renderLlmsFull(): Promise<string> {
  const [docs, readme] = await Promise.all([listDocs(), readReadme()])
  const docBySlug = new Map(docs.map(d => [d.frontmatter.slug, d]))

  const header = `# Promus — full machine-readable docs

> Sovereign AI agents on Arbitrum. This file inlines every documentation page plus the repo README. Sections separated by horizontal rules. Each doc body is preceded by a source pointer when frontmatter declares one.

> Single most common install failure: bun must be installed FIRST. The CLI shebangs \`#!/usr/bin/env bun\`. \`npm install -g\` succeeds and the binary lands on PATH, but it exits at runtime with \`env: bun: No such file or directory\`. Always run \`curl -fsSL https://bun.sh/install | bash\` then \`bun add -g promus\`.

> \`promus init\` is interactive: blocking @clack/prompts selects, no full env-var bypass. Two completion paths from an agent: guide the human, or puppet the TUI with \`tmux send-keys\` if you have shell access. Naive stdin piping fails because @clack checks for a real TTY.

> Brain: Claude via \`ANTHROPIC_API_KEY\`. Memory: IPFS via \`ANIMA_IPFS_API_URL\` (a Kubo node). Binary: \`promus\`. Engine: bun >=1.1.`

  const sections: string[] = [header]

  sections.push(`## README\n\n${sourceBlock('README.md')}${readme.trim()}`)

  const seen = new Set<string>()
  for (const slug of FULL_ORDER) {
    const d = docBySlug.get(slug)
    if (!d) continue
    sections.push(renderDocSection(d))
    seen.add(slug)
  }
  for (const d of docs) {
    if (seen.has(d.frontmatter.slug)) continue
    sections.push(renderDocSection(d))
  }

  return `${sections.join('\n\n---\n\n')}\n`
}

function sourceBlock(source: string | undefined): string {
  return source ? `> Source: ${REPO_BASE}${source}\n\n` : ''
}

function renderDocSection(d: Doc): string {
  return `## ${d.frontmatter.title}\n\n${sourceBlock(d.frontmatter.source)}${d.content.trim()}`
}

async function renderDocRaw(slug: string): Promise<string | null> {
  const doc = await getDoc(slug)
  if (!doc) return null
  return `${sourceBlock(doc.frontmatter.source)}${doc.content.trim()}`
}

async function readReadme(): Promise<string> {
  const readmePath = path.join(process.cwd(), '..', '..', 'README.md')
  try {
    return await fs.readFile(readmePath, 'utf8')
  } catch {
    return '# Promus\n\nREADME not bundled in this build. Read it at https://github.com/JemIIahh/promus#readme'
  }
}
