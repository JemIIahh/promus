import { createHash } from 'node:crypto'
import { describe, expect, it } from 'bun:test'
import { bytesToHex } from 'viem'
import { cidToSlotHash, isSlotHash, slotHashToCid } from './cid'

describe('cid <-> slot hash codec', () => {
  it('round-trips a 32-byte digest through CIDv1(raw, sha2-256)', () => {
    const digest = createHash('sha256').update('anima').digest()
    const hash = bytesToHex(digest)
    const cid = slotHashToCid(hash)
    expect(cid.startsWith('bafkrei')).toBe(true) // CIDv1 raw sha2-256 base32 prefix
    expect(cidToSlotHash(cid)).toBe(hash)
  })

  it('matches Kubo: cidToSlotHash(cid) === sha256 of the content', () => {
    // Known vector: `echo -n "" | ipfs add --cid-version=1 --raw-leaves` →
    // empty file CID; its digest is sha256("").
    const emptyDigest = bytesToHex(createHash('sha256').update(Uint8Array.of()).digest())
    const cid = slotHashToCid(emptyDigest)
    expect(cidToSlotHash(cid)).toBe(emptyDigest)
  })

  it('isSlotHash recognizes 0x bytes32 vs a CID', () => {
    expect(isSlotHash('0x' + 'a'.repeat(64))).toBe(true)
    expect(isSlotHash('bafkreigh2akiscaildc')).toBe(false)
    expect(isSlotHash('0x' + 'a'.repeat(63))).toBe(false)
  })

  it('rejects a non-raw (dag-pb) CID that cannot fit bytes32', () => {
    // bafybei… is CIDv1 dag-pb (codec 0x70) — a chunked root, not anchorable.
    expect(() => cidToSlotHash('bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi')).toThrow()
  })

  it('rejects a non-base32 multibase prefix', () => {
    expect(() => cidToSlotHash('zb2rhe5P4gXftAwvA4eXQ5HJwsER2owDyS9sKaQRRVQPn93bA')).toThrow()
  })
})
