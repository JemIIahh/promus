import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { cidToSlotHash, isSlotHash, slotHashToCid } from './cid'
import { LocalStubStorage } from './local-stub'
import type { Storage } from './types'

/**
 * IPFS-backed Storage. anima only ever exercises putBlob/getBlob (the encrypted
 * memory/keystore blobs whose CID is anchored on-chain in the iNFT slot); KV and
 * appendLog are part of the interface but unused, so they delegate to a small
 * local cache. This is the decentralized blob backend that replaces 0G Storage.
 *
 * Upload uses the IPFS HTTP API (Kubo-compatible `/api/v0/add`), so it works
 * with a local Kubo node or any hosted endpoint that speaks that API; reads
 * prefer a public/edge gateway and fall back to `/api/v0/cat`. Content is
 * already ECIES/AES-encrypted before it reaches here — IPFS only ever sees
 * ciphertext, preserving the platform-never-sees-plaintext invariant.
 */
export interface IpfsStorageOpts {
  /** IPFS HTTP API base, e.g. http://127.0.0.1:5001 or a hosted Kubo endpoint. */
  apiUrl: string
  /** Read gateway base incl. trailing /ipfs/, e.g. https://ipfs.io/ipfs/. */
  gatewayUrl?: string
  /** Optional bearer token for authenticated/hosted pinning APIs. */
  token?: string
  /** Local dir backing the (unused) KV/log methods. */
  cacheDir?: string
}

const ADD_TIMEOUT_MS = 60_000
const GET_TIMEOUT_MS = 60_000

export class IpfsStorage implements Storage {
  private readonly apiUrl: string
  private readonly gatewayUrl?: string
  private readonly token?: string
  private readonly local: LocalStubStorage

  constructor(opts: IpfsStorageOpts) {
    this.apiUrl = opts.apiUrl.replace(/\/$/, '')
    this.gatewayUrl = opts.gatewayUrl?.replace(/\/$/, '')
    this.token = opts.token
    this.local = new LocalStubStorage(opts.cacheDir ?? join(homedir(), '.anima', 'ipfs-cache'))
  }

  private authHeaders(): Record<string, string> {
    return this.token ? { authorization: `Bearer ${this.token}` } : {}
  }

  async putBlob(bytes: Uint8Array): Promise<string> {
    const form = new FormData()
    // Copy into a fresh ArrayBuffer — a Uint8Array view may be a subarray of a
    // larger buffer, and Blob would otherwise capture the whole backing store.
    const buf = bytes.slice().buffer
    form.append('file', new Blob([buf], { type: 'application/octet-stream' }), 'blob')

    // raw-leaves + a 1 MiB chunk size keep any anchor-sized blob in a single raw
    // block, so the CID is CIDv1(raw, sha2-256) and its digest fits the bytes32
    // iNFT slot. Larger blobs would chunk into a dag-pb root that cidToSlotHash
    // rejects with a clear error.
    const url = `${this.apiUrl}/api/v0/add?pin=true&cid-version=1&raw-leaves=true&chunker=size-1048576`
    const res = await fetchWithTimeout(url, { method: 'POST', headers: this.authHeaders(), body: form }, ADD_TIMEOUT_MS)
    if (!res.ok) throw new Error(`ipfs add failed: ${res.status} ${(await res.text()).slice(0, 200)}`)
    // Kubo streams newline-delimited JSON; the final non-empty line is the root.
    const text = await res.text()
    const lines = text.trim().split('\n').filter(Boolean)
    const last = JSON.parse(lines[lines.length - 1] ?? '{}') as { Hash?: string }
    if (!last.Hash) throw new Error(`ipfs add returned no CID: ${text.slice(0, 200)}`)
    // Return the bytes32 slot hash (the CID's sha2-256 digest), matching the
    // local-stub contract so the value anchors directly into the iNFT slot.
    return cidToSlotHash(last.Hash)
  }

  async getBlob(cidOrHash: string): Promise<Uint8Array | null> {
    // The on-chain slot stores a 0x bytes32 digest; rebuild the CID for it.
    // A raw CID string is also accepted for direct/legacy reads.
    const cid = isSlotHash(cidOrHash) ? slotHashToCid(cidOrHash) : cidOrHash
    // Prefer a gateway (cheap, cacheable, no auth); fall back to the API's cat.
    if (this.gatewayUrl) {
      try {
        const res = await fetchWithTimeout(`${this.gatewayUrl}/${cid}`, {}, GET_TIMEOUT_MS)
        if (res.ok) return new Uint8Array(await res.arrayBuffer())
        if (res.status === 404) return null
      } catch {
        // fall through to API cat
      }
    }
    try {
      const res = await fetchWithTimeout(
        `${this.apiUrl}/api/v0/cat?arg=${encodeURIComponent(cid)}`,
        { method: 'POST', headers: this.authHeaders() },
        GET_TIMEOUT_MS,
      )
      if (!res.ok) return null
      return new Uint8Array(await res.arrayBuffer())
    } catch {
      return null
    }
  }

  // ── Unused by anima (on-chain slot is the mutable pointer) — local cache. ──
  putKV(stream: string, key: string, value: Uint8Array): Promise<void> {
    return this.local.putKV(stream, key, value)
  }
  getKV(stream: string, key: string): Promise<Uint8Array | null> {
    return this.local.getKV(stream, key)
  }
  appendLog(stream: string, entry: Uint8Array): Promise<string> {
    return this.local.appendLog(stream, entry)
  }
}

function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer))
}

/** Default local cache dir for the IPFS adapter's unused KV/log methods. */
export function defaultIpfsCacheDir(): string {
  return process.env.ANIMA_IPFS_CACHE_DIR ?? join(tmpdir(), 'anima-ipfs-cache')
}
