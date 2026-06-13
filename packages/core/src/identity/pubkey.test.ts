import { describe, expect, it } from 'bun:test'
import { type Hex, parseTransaction } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { derivePubkeyHex, recoverPubkeyFromTx } from './pubkey'

describe('derivePubkeyHex', () => {
  it('returns 65 bytes uncompressed 04-prefixed', () => {
    const priv = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
    const pub = derivePubkeyHex(priv)
    expect(pub.length).toBe(2 + 130) // 0x + 130 hex
    expect(pub.slice(0, 4)).toBe('0x04')
  })

  it('matches the address derived by viem', () => {
    const priv = '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d'
    const pub = derivePubkeyHex(priv)
    const account = privateKeyToAccount(priv)
    // Address is keccak256(pubkey[1:])[-20:]; viem already does this. Just
    // verify our pubkey -> address roundtrips by using viem's helper.
    const { keccak256, slice } = require('viem')
    const pubBytesNoPrefix = `0x${pub.slice(4)}`
    const expectedAddrLowercase = slice(
      keccak256(pubBytesNoPrefix as `0x${string}`),
      12,
    ).toLowerCase()
    expect(expectedAddrLowercase).toBe(account.address.toLowerCase())
  })

  it('accepts 0x-less hex input', () => {
    const priv = '4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d'
    const pub = derivePubkeyHex(priv)
    expect(pub.slice(0, 4)).toBe('0x04')
    expect(pub.length).toBe(2 + 130)
  })

  it('produces different pubkeys for different privkeys', () => {
    const a = derivePubkeyHex('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d')
    const b = derivePubkeyHex('0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d')
    expect(a).not.toBe(b)
  })
})

describe('recoverPubkeyFromTx', () => {
  it('recovers the signer pubkey (== derivePubkeyHex) from a signed eip1559 tx', async () => {
    const priv = generatePrivateKey()
    const account = privateKeyToAccount(priv)
    const expectedPubkey = derivePubkeyHex(priv)

    const signed = await account.signTransaction({
      type: 'eip1559',
      chainId: 421614,
      nonce: 7,
      to: `0x${'11'.repeat(20)}`,
      value: 0n,
      gas: 21_000n,
      data: '0x',
      maxFeePerGas: 100_000_000n,
      maxPriorityFeePerGas: 100_000_000n,
      accessList: [],
    })
    const parsed = parseTransaction(signed)
    // Mock the RPC client: getTransaction returns the RPC-shaped tx (uses `input`).
    // biome-ignore lint/suspicious/noExplicitAny: minimal PublicClient stand-in
    const mockClient = { getTransaction: async () => ({ ...parsed, input: parsed.data ?? '0x' }) } as any

    const recovered = await recoverPubkeyFromTx(mockClient, '0xdeadbeef' as Hex, account.address)
    expect(recovered.toLowerCase()).toBe(expectedPubkey.toLowerCase())
  })

  it('throws when the recovered signer differs from expectedAddress', async () => {
    const account = privateKeyToAccount(generatePrivateKey())
    const signed = await account.signTransaction({
      type: 'eip1559',
      chainId: 421614,
      nonce: 0,
      to: `0x${'22'.repeat(20)}`,
      value: 0n,
      gas: 21_000n,
      data: '0x',
      maxFeePerGas: 1_000_000n,
      maxPriorityFeePerGas: 1_000_000n,
      accessList: [],
    })
    const parsed = parseTransaction(signed)
    // biome-ignore lint/suspicious/noExplicitAny: minimal PublicClient stand-in
    const mockClient = { getTransaction: async () => ({ ...parsed, input: '0x' }) } as any
    await expect(
      recoverPubkeyFromTx(mockClient, '0xdead' as Hex, `0x${'99'.repeat(20)}`),
    ).rejects.toThrow(/wrong tx signer/)
  })
})
