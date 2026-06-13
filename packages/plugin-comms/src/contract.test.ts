import { describe, expect, test } from 'bun:test'
import type { Hex, PublicClient } from 'viem'
import { PromusInboxClient } from './contract'

const INBOX = '0xF937b333978fd8B9A6798b90F5ce8C93e365540b' as const
const PUBKEY_A = `0x04${'aa'.repeat(64)}` as Hex // 65-byte uncompressed pubkey
const PUBKEY_B = `0x04${'bb'.repeat(64)}` as Hex
const PUBKEY_D = `0x04${'dd'.repeat(64)}` as Hex

function log(from: string, to: string, payload: Hex, blockNumber: bigint) {
  return {
    args: { from, to, payload, dataHash: `0x${'00'.repeat(32)}` },
    blockNumber,
    transactionHash: `0x${blockNumber.toString(16).padStart(64, '0')}`,
    logIndex: 0,
  }
}

function clientWithLogs(logs: unknown[]): PublicClient {
  return {
    getLogs: async () => logs,
    getBlockNumber: async () => 1_000_000n,
  } as unknown as PublicClient
}

const A = '0xaAaA000000000000000000000000000000000001'
const B = '0xbBbB000000000000000000000000000000000002'
const C = '0xcCcC000000000000000000000000000000000003'
const D = '0xdDdD000000000000000000000000000000000004'

describe('PromusInboxClient.listSelfRegistered', () => {
  test('returns one entry per self-registered agent, newest block wins, sorted desc', async () => {
    const client = clientWithLogs([
      log(A, A, PUBKEY_A, 100n), // A self-registers
      log(A, A, PUBKEY_A, 200n), // A re-registers later — dedup, keep 200
      log(B, B, PUBKEY_B, 150n), // B self-registers
    ])
    const inbox = new PromusInboxClient({ address: INBOX, publicClient: client })
    const agents = await inbox.listSelfRegistered()
    expect(agents.map(a => [a.address, Number(a.blockNumber)])).toEqual([
      [A, 200],
      [B, 150],
    ])
    expect(agents[0]?.pubkey).toBe(PUBKEY_A)
  })

  test('skips non-self messages (from != to) and malformed pubkey payloads', async () => {
    const client = clientWithLogs([
      log(A, C, PUBKEY_A, 100n), // real message A→C, not a registration
      log(D, D, '0x1234' as Hex, 120n), // self message but payload is not a 65-byte pubkey
      log(B, B, PUBKEY_B, 130n), // valid self-register
    ])
    const inbox = new PromusInboxClient({ address: INBOX, publicClient: client })
    const agents = await inbox.listSelfRegistered()
    expect(agents.map(a => a.address)).toEqual([B])
    expect(agents.find(a => a.address === D)).toBeUndefined()
  })

  test('falls back to a recent window when an unbounded getLogs throws', async () => {
    let calls = 0
    const client = {
      getBlockNumber: async () => 1_000_000n,
      getLogs: async () => {
        calls++
        if (calls === 1) throw new Error('range too large')
        return [log(B, B, PUBKEY_B, 999_000n)]
      },
    } as unknown as PublicClient
    const inbox = new PromusInboxClient({ address: INBOX, publicClient: client })
    const agents = await inbox.listSelfRegistered()
    expect(calls).toBe(2)
    expect(agents.map(a => a.address)).toEqual([B])
    expect(agents[0]?.pubkey).toBe(PUBKEY_B)
  })

  test('returns empty list when no agents have registered', async () => {
    const inbox = new PromusInboxClient({ address: INBOX, publicClient: clientWithLogs([]) })
    expect(await inbox.listSelfRegistered()).toEqual([])
  })
})
