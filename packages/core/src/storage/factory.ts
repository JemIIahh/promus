import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Hex } from 'viem'
import type { PromusNetwork } from '../config'
import { IpfsStorage } from './ipfs'
import { LocalStubStorage } from './local-stub'
import type { Storage } from './types'

/**
 * Construct the active Storage backend. Single chokepoint so call sites don't
 * hardcode a provider. Backend is chosen from env:
 *
 *   PROMUS_STORAGE_BACKEND = 'ipfs' | 'local'   (default: 'ipfs' if an IPFS API
 *                                                URL is set, else 'local')
 *   PROMUS_IPFS_API_URL     IPFS HTTP API base   (e.g. http://127.0.0.1:5001)
 *   PROMUS_IPFS_GATEWAY     read gateway + /ipfs/ (e.g. https://ipfs.io/ipfs/)
 *   PROMUS_IPFS_API_TOKEN   optional bearer for hosted pinning endpoints
 *   PROMUS_STORAGE_DIR      local-backend root   (default: ~/.promus/storage)
 *
 * `network`/`privkeyHex` are accepted for call-site compatibility (the prior
 * 0G backend keyed off them); the EVM-agnostic backends ignore them.
 */
export interface CreateStorageOpts {
  network?: PromusNetwork
  privkeyHex?: Hex
}

export function createStorage(_opts: CreateStorageOpts = {}): Storage {
  const apiUrl = process.env.PROMUS_IPFS_API_URL
  const backend = process.env.PROMUS_STORAGE_BACKEND ?? (apiUrl ? 'ipfs' : 'local')

  if (backend === 'ipfs') {
    if (!apiUrl) {
      throw new Error(
        'PROMUS_STORAGE_BACKEND=ipfs but PROMUS_IPFS_API_URL is unset. Set it to an IPFS HTTP API ' +
          '(local Kubo: http://127.0.0.1:5001) or use PROMUS_STORAGE_BACKEND=local for dev.',
      )
    }
    return new IpfsStorage({
      apiUrl,
      gatewayUrl: process.env.PROMUS_IPFS_GATEWAY,
      token: process.env.PROMUS_IPFS_API_TOKEN,
    })
  }

  return new LocalStubStorage(process.env.PROMUS_STORAGE_DIR ?? join(homedir(), '.promus', 'storage'))
}

/**
 * Fetch an encrypted blob by its content id, with no signer/funds required —
 * used by `promus restore` / inspect to recover a keystore from just the CID
 * anchored on-chain. Drop-in replacement for the old 0G `downloadBlobByRoot`
 * (the `network` arg is kept for call-site compatibility and ignored).
 */
export function downloadBlobByRoot(_network: PromusNetwork | undefined, cid: string): Promise<Uint8Array | null> {
  return createStorage({ network: _network }).getBlob(cid)
}
