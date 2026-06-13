import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { type SannClient, derivePubkeyHex, recoverPubkeyFromTx, subnameNode } from 'promus-core'
import { type Address, type Hex, type PublicClient, getAddress, parseAbiItem } from 'viem'

/** PromusInbox `Message` event — `from` is indexed, so logs filter by sender. */
const MESSAGE_EVENT = parseAbiItem(
  'event Message(address indexed from, address indexed to, bytes payload, bytes32 dataHash)',
)

/**
 * Resolve a recipient identifier (name or raw EOA) to its EOA address +
 * uncompressed secp256k1 pubkey for ECIES encryption.
 *
 * Primary path: `.0g` text records. Promus publishes both `address` and `pubkey`
 * on its subname during init (Phase 7+). Lookup is one SANN resolver call.
 *
 * Raw-EOA input is supported only for diagnostic / debug paths today; pubkey
 * recovery from chain history is not in MVP scope. The resolver emits a clear
 * error directing the operator to use a `.promus.0g` name instead.
 */

export interface ResolvedRecipient {
  eoa: Address
  pubkey: Hex
  source: 'subname-text-record' | 'recovered-from-tx' | 'cache'
  /** The canonical name if input was a name, else null. */
  name: string | null
}

export interface PubkeyResolverOpts {
  /** Read-only viem client for the agent's network. */
  publicClient: PublicClient
  /** Per-agent state dir under which the resolver caches pubkey lookups. */
  agentDir: string
  /** Optional override of cache TTL. Default 24h. */
  cacheTtlMs?: number
  /** Pre-built SannClient (privkey-bound; used purely for reads here). */
  sann: Pick<SannClient, 'readText'>
  /**
   * PromusInbox address. When set, raw 0x recipients resolve trustlessly:
   * find a Message they sent (`from` is indexed) and recover their secp256k1
   * pubkey from that tx — no name service required. The non-0G path.
   */
  inboxAddress?: Address
}

interface CacheRow {
  eoa: Address
  pubkey: Hex
  name: string | null
  ts: number
}

interface CacheFile {
  v: 1
  byKey: Record<string, CacheRow>
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000

export class PubkeyResolver {
  private readonly publicClient: PublicClient
  private readonly cachePath: string
  private readonly ttlMs: number
  private readonly sann: Pick<SannClient, 'readText'>
  private readonly inboxAddress?: Address
  private cache: CacheFile

  constructor(opts: PubkeyResolverOpts) {
    this.publicClient = opts.publicClient
    this.cachePath = join(opts.agentDir, 'comms', 'pubkey-cache.json')
    this.ttlMs = opts.cacheTtlMs ?? DEFAULT_TTL_MS
    this.sann = opts.sann
    this.inboxAddress = opts.inboxAddress
    this.cache = this.loadCache()
  }

  /**
   * Resolve `to` to (eoa, pubkey). Names like `alice.promus.0g` are looked up
   * via SANN text records; raw EOAs throw with a directive.
   */
  async resolve(to: string): Promise<ResolvedRecipient> {
    const trimmed = to.trim()
    if (trimmed.length === 0) throw new Error('empty recipient')

    if (trimmed.endsWith('.0g')) {
      return await this.resolveByName(trimmed)
    }
    if (trimmed.startsWith('0x') && trimmed.length === 42) {
      return await this.resolveByAddress(getAddress(trimmed) as Address)
    }
    throw new Error(`unrecognized recipient format: ${trimmed.slice(0, 80)}`)
  }

  /**
   * Resolve a raw EOA to its ECIES pubkey with no name service. Find a message
   * the address sent through PromusInbox (`from` is indexed) and recover the
   * signer's secp256k1 pubkey from that message's transaction. A Promus agent's
   * ECIES key IS its EOA keypair, so the recovered key is exactly what we
   * encrypt to. Requires the peer to have sent ≥1 inbox message (agents self-
   * register on startup); throws a clear error otherwise.
   */
  private async resolveByAddress(addr: Address): Promise<ResolvedRecipient> {
    const key = addr.toLowerCase()
    const cached = this.cache.byKey[key]
    if (cached && Date.now() - cached.ts < this.ttlMs) {
      return { ...cached, source: 'cache' }
    }
    if (!this.inboxAddress) {
      throw new Error(
        `cannot resolve raw address ${addr}: no PromusInbox configured for chain pubkey recovery`,
      )
    }
    const txHash = await this.findInboxTxFrom(addr)
    if (!txHash) {
      throw new Error(
        `${addr} has no PromusInbox activity on chain; the peer must come online (self-register) before it can be messaged`,
      )
    }
    const pubkey = await recoverPubkeyFromTx(this.publicClient, txHash, addr)
    const row: CacheRow = { eoa: addr, pubkey, name: null, ts: Date.now() }
    this.cache.byKey[key] = row
    this.persist()
    return { ...row, source: 'recovered-from-tx' }
  }

  /** Newest tx hash of a Message this address sent via PromusInbox, or null. */
  private async findInboxTxFrom(addr: Address): Promise<Hex | null> {
    const run = (fromBlock: bigint | 'earliest') =>
      this.publicClient.getLogs({
        address: this.inboxAddress,
        event: MESSAGE_EVENT,
        args: { from: addr },
        fromBlock,
        toBlock: 'latest',
      })
    let logs: Awaited<ReturnType<typeof run>>
    try {
      logs = await run('earliest')
    } catch {
      // Some RPCs cap getLogs block ranges; retry over a recent window.
      const latest = await this.publicClient.getBlockNumber()
      logs = await run(latest > 500_000n ? latest - 500_000n : 0n)
    }
    return logs.at(-1)?.transactionHash ?? null
  }

  private async resolveByName(name: string): Promise<ResolvedRecipient> {
    const cached = this.cache.byKey[name.toLowerCase()]
    if (cached && Date.now() - cached.ts < this.ttlMs) {
      return { ...cached, source: 'cache' }
    }
    // Strip the `.promus.0g` suffix to get the bare label SANN expects.
    if (!name.endsWith('.promus.0g')) {
      throw new Error(`only *.promus.0g names supported in MVP; got ${name}`)
    }
    const label = name.slice(0, -'.promus.0g'.length)
    if (!label) throw new Error(`empty subname label in ${name}`)
    const node = subnameNode(label)
    const [addressText, pubkeyText] = await Promise.all([
      this.sann.readText(node, 'address').catch(() => ''),
      this.sann.readText(node, 'pubkey').catch(() => ''),
    ])
    if (!addressText) {
      throw new Error(`${name}: address text record not set`)
    }
    if (!pubkeyText) {
      throw new Error(
        `${name}: pubkey text record not set; ask them to run \`promus publish-pubkey\``,
      )
    }
    const eoa = getAddress(addressText) as Address
    const pubkey = (pubkeyText.startsWith('0x') ? pubkeyText : `0x${pubkeyText}`) as Hex
    if (pubkey.length !== 2 + 130) {
      throw new Error(`${name}: pubkey text record malformed (length ${pubkey.length})`)
    }
    const row: CacheRow = { eoa, pubkey, name, ts: Date.now() }
    this.cache.byKey[name.toLowerCase()] = row
    this.persist()
    return { ...row, source: 'subname-text-record' }
  }

  /**
   * Drop one cached entry, e.g. after a name transfer event.
   */
  invalidate(nameOrAddr: string): void {
    delete this.cache.byKey[nameOrAddr.toLowerCase()]
    this.persist()
  }

  private loadCache(): CacheFile {
    if (!existsSync(this.cachePath)) return { v: 1, byKey: {} }
    try {
      const parsed = JSON.parse(readFileSync(this.cachePath, 'utf8'))
      if (parsed?.v === 1 && parsed.byKey && typeof parsed.byKey === 'object') return parsed
    } catch {}
    return { v: 1, byKey: {} }
  }

  private persist(): void {
    const dir = dirname(this.cachePath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(this.cachePath, JSON.stringify(this.cache, null, 2))
  }
}

/**
 * Convenience: ensure the calling agent's own pubkey is published as a `.0g`
 * text record. Idempotent; reads the current value first and skips the
 * `setText` if it already matches the agent's derived pubkey. Used by
 * `promus publish-pubkey` and by listener boot for backfill of pre-Phase-7
 * agents.
 */
export async function ensureOwnPubkeyPublished(opts: {
  privkeyHex: Hex
  subname: string
  sann: SannClient
}): Promise<{ alreadySet: boolean; txHash?: Hex }> {
  const expected = derivePubkeyHex(opts.privkeyHex)
  if (!opts.subname.endsWith('.promus.0g')) {
    throw new Error(`only *.promus.0g supported, got ${opts.subname}`)
  }
  const label = opts.subname.slice(0, -'.promus.0g'.length)
  const node = subnameNode(label)
  const current = await opts.sann.readText(node, 'pubkey').catch(() => '')
  if (current && current.toLowerCase() === expected.toLowerCase()) {
    return { alreadySet: true }
  }
  const txHash = await opts.sann.setText(node, 'pubkey', expected)
  return { alreadySet: false, txHash }
}
