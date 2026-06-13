import { type Hex, bytesToHex, hexToBytes } from 'viem'

/**
 * Minimal, dependency-free codec between an IPFS CID and the `bytes32` content
 * hash anchored in an iNFT IntelligentData slot.
 *
 * promus adds blobs with `cid-version=1&raw-leaves=true`, so any blob that fits
 * in a single block is addressed by `CIDv1(codec=raw, multihash=sha2-256)`. The
 * multihash digest of that CID is exactly `sha256(bytes)` — the same 32 bytes
 * the local-stub backend returns as `0x<sha256>`. We anchor that digest on-chain
 * (it fits bytes32) and reconstruct the CID losslessly on read, since the codec
 * (raw) and hash (sha2-256) are fixed by our add flags.
 *
 * Multibase: CIDv1 from Kubo defaults to base32 lowercase (prefix `b`).
 * CID byte layout: [0x01 version][0x55 raw][0x12 sha2-256][0x20 len=32][digest].
 */

const BASE32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567'
const CID_PREFIX = Uint8Array.from([0x01, 0x55, 0x12, 0x20]) // cidv1, raw, sha2-256, 32 bytes

function base32LowerNoPadEncode(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const b of bytes) {
    value = (value << 8) | b
    bits += 8
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  return out
}

function base32LowerNoPadDecode(s: string): Uint8Array {
  const out: number[] = []
  let bits = 0
  let value = 0
  for (const ch of s.toLowerCase()) {
    const idx = BASE32_ALPHABET.indexOf(ch)
    if (idx === -1) throw new Error(`invalid base32 character '${ch}' in CID`)
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Uint8Array.from(out)
}

/** True for a `0x`-prefixed 32-byte hex string (a slot content hash). */
export function isSlotHash(value: string): value is Hex {
  return /^0x[0-9a-fA-F]{64}$/.test(value)
}

/**
 * Reconstruct the `CIDv1(raw, sha2-256)` for a 32-byte slot hash. Inverse of
 * {@link cidToSlotHash}. Used on read: the on-chain slot yields the digest, and
 * we rebuild the exact CID to fetch from IPFS.
 */
export function slotHashToCid(hash: Hex): string {
  const digest = hexToBytes(hash)
  if (digest.length !== 32) throw new Error(`slot hash must be 32 bytes, got ${digest.length}`)
  const full = new Uint8Array(CID_PREFIX.length + 32)
  full.set(CID_PREFIX, 0)
  full.set(digest, CID_PREFIX.length)
  return `b${base32LowerNoPadEncode(full)}`
}

/**
 * Extract the 32-byte sha2-256 digest from a `CIDv1(raw, sha2-256)` and return
 * it as a `0x` bytes32 suitable for an iNFT slot. Throws if the CID is not a
 * single-block raw sha2-256 CIDv1 (e.g. a chunked dag-pb root), since such a CID
 * cannot be represented as a single on-chain bytes32.
 */
export function cidToSlotHash(cid: string): Hex {
  if (!cid.startsWith('b')) {
    throw new Error(`unsupported CID multibase (expected base32 'b' prefix): ${cid.slice(0, 12)}…`)
  }
  const full = base32LowerNoPadDecode(cid.slice(1))
  if (full.length !== CID_PREFIX.length + 32) {
    throw new Error(`unexpected CID length ${full.length}; not a single-block raw sha2-256 CIDv1`)
  }
  if (full[0] !== 0x01) throw new Error('not a CIDv1')
  if (full[1] !== 0x55) throw new Error('CID codec is not raw (blob was chunked into a dag-pb root?)')
  if (full[2] !== 0x12 || full[3] !== 0x20) throw new Error('CID multihash is not sha2-256/32')
  return bytesToHex(full.slice(CID_PREFIX.length))
}
