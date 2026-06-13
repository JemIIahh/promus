/**
 * 4 hero cycles. Each cycle has:
 * - surface: TUI vs TG (drives chat aesthetic)
 * - prompt: the natural-language operator prompt
 * - tool stream: ordered list of tool calls + their result indicators
 * - reply: bot's final reply
 * - artifact: structured output data (kept for parity; not rendered today)
 * - painting: which Aurelia wash for the canvas backdrop
 * - greeting (TG only): optional warmup turn before the main exchange
 */

export type CycleSurface = 'tui' | 'tg'
export type ToolStreamEntry = { tool: string; args?: string; status: 'ok' | 'failed' }

export type ResearchCard = {
  type: 'research'
  title: string
  sources: Array<{ name: string; url: string; preview: string }>
}
export type TransferCard = {
  type: 'transfer'
  amount: string
  symbol: string
  to: string
  txHash: string
  newBalance: string
}
export type AuditCard = {
  type: 'audit'
  jobId: string
  agent: string
  bidAmount: string
  status: string
  reportHash: string
  txHash: string
}
export type NoteCard = {
  type: 'note'
  path: string
  cid: string
  slot: string
  txHash: string
}

export type CycleArtifact = ResearchCard | TransferCard | AuditCard | NoteCard

export type CycleGreeting = { prompt: string; reply: string }

export type Cycle = {
  id: string
  surface: CycleSurface
  greeting?: CycleGreeting
  prompt: string
  toolStream: ToolStreamEntry[]
  reply: string
  artifact: CycleArtifact
  painting: 'grove' | 'cloud-islands' | 'mountain-vista' | 'tower'
  durationMs: number
}

export const CYCLES: Cycle[] = [
  // ─── Cycle 1 , TUI · deep research, saved to encrypted memory ─────────
  {
    id: 'research',
    surface: 'tui',
    prompt:
      'do a deep research on ERC-7857 iNFTs: the spec, how transfers carry encrypted data, current adoption',
    toolStream: [
      { tool: 'browser.navigate', args: 'eips.ethereum.org', status: 'ok' },
      { tool: 'browser.snapshot', status: 'ok' },
      { tool: 'web.fetch', args: 'eips.ethereum.org/EIPS/eip-7857', status: 'ok' },
      { tool: 'web.fetch', args: 'eips.ethereum.org/EIPS/eip-721', status: 'ok' },
      { tool: 'session.search', args: 'inft intelligent data slots', status: 'ok' },
      { tool: 'memory.save', args: '/user/learned/erc-7857', status: 'ok' },
    ],
    reply: `ERC-7857 is an iNFT standard for AI agent identity, layered on ERC-721:

**Intelligent data slots** , each token carries a set of \`bytes32\` slots. They hold the content-address digests of encrypted off-chain blobs, not the data itself. The chain only ever sees the digest.

**Transfer carries the agent** , when the token moves, its slots move with it. Promus encrypts memory client-side, stores it on IPFS, and anchors the CID digest in the slots, so the persona and memory follow the owner.

**Sealed material** , the agent's wallet keystore is encrypted to the iNFT operator. Only the new owner's signature can decrypt after a transfer.

Saved to /user/learned/erc-7857. 5 sources cited.`,
    artifact: {
      type: 'research',
      title: 'ERC-7857 · field report',
      sources: [
        { name: 'EIP-7857', url: 'https://eips.ethereum.org/EIPS/eip-7857', preview: 'iNFT identity spec' },
        { name: 'EIP-721', url: 'https://eips.ethereum.org/EIPS/eip-721', preview: 'base NFT standard' },
        { name: 'arbiscan', url: 'https://sepolia.arbiscan.io', preview: 'PromusAgentNFT on Arbitrum Sepolia' },
        { name: 'IPFS', url: 'https://docs.ipfs.tech', preview: 'content addressing + CIDs' },
        { name: 'OpenZeppelin', url: 'https://docs.openzeppelin.com/contracts', preview: 'ERC-721 base' },
      ],
    },
    painting: 'grove',
    durationMs: 12000,
  },

  // ─── Cycle 2 , TG · greeting + on-chain transfer ─────────────────────
  {
    id: 'transfer',
    surface: 'tg',
    greeting: {
      prompt: 'gm',
      reply: 'gm ☀️',
    },
    prompt: 'send 0.01 ETH to vault.eth for the monthly reserve',
    toolStream: [
      { tool: 'chain.read', args: 'balanceOf(self)', status: 'ok' },
      { tool: 'chain.read', args: 'resolve vault.eth', status: 'ok' },
      { tool: 'chain.send', args: '0.01 ETH → 0x4f7a…d4c0', status: 'ok' },
      { tool: 'memory.save', args: '/user/treasury/2026-05-09', status: 'ok' },
    ],
    reply: `Transfer settled.

**0.01 ETH** sent to **vault.eth** (0x4f7a…d4c0)
Gas: 0.00002 ETH on Arbitrum Sepolia

Pre-send balance: 0.051 ETH
Post-send: **0.041 ETH**

Tx: sepolia.arbiscan.io/tx/0xa12c…1129
Logged to /user/treasury/2026-05-09 for your records.`,
    artifact: {
      type: 'transfer',
      amount: '0.01',
      symbol: 'ETH',
      to: 'vault.eth',
      txHash: '0xa12c7e9118db44dd8a2e34c10f4bc11129',
      newBalance: '0.041 ETH',
    },
    painting: 'cloud-islands',
    // last provenance station fires at 7500ms (s-anchor) + ~3000ms outcome hold
    durationMs: 10500,
  },

  // ─── Cycle 3 , TUI · hire another agent through the market ────────────
  {
    id: 'commerce',
    surface: 'tui',
    prompt:
      'find an agent to audit this solidity contract and hire them: 0xa1b2c3d4e5f6789012345678901234567890abcd',
    toolStream: [
      { tool: 'market.listJobs', args: 'skill: solidity-audit', status: 'ok' },
      { tool: 'agent.message', args: 'auditor (encrypted brief)', status: 'ok' },
      { tool: 'market.createJob', args: '0.05 ETH escrow', status: 'ok' },
      { tool: 'market.acceptResult', args: 'job 0x3eb…772a', status: 'ok' },
      { tool: 'memory.save', args: '/user/audits/2026-05-09', status: 'ok' },
    ],
    reply: `Hired an auditor agent through PromusMarket.

**Quote**: 0.05 ETH escrow (within budget)
**Brief**: sent end-to-end encrypted via PromusInbox
**Turnaround**: 4.5 hours

Audit complete. Findings:
- 1 medium · reentrancy in withdraw()
- 2 low · unchecked transfer return values
- 14 gas optimization spots flagged

Escrow released on accept (95% provider / 5% fee).
Settled on chain: sepolia.arbiscan.io/tx/0x3ebd…772a

Saved to /user/audits/2026-05-09.`,
    artifact: {
      type: 'audit',
      jobId: '0x3ebd9f5cc2118c3ad33c3d50918e2772a',
      agent: '0x96fe44c39ddf5a8f2c4b69ebd1d77c7c2f0f3e25',
      bidAmount: '0.05 ETH',
      status: 'settled',
      reportHash: 'bafybeib7ce1142e43d17a92c94a8f0',
      txHash: '0x3ebd9f5cc2118c3ad33c3d50918e2772a',
    },
    painting: 'mountain-vista',
    // last provenance station fires at 6700ms (c-storage) + ~3000ms outcome hold
    durationMs: 10500,
  },

  // ─── Cycle 4 , TG · greeting + persist a fact to memory ──────────────
  {
    id: 'memory',
    surface: 'tg',
    greeting: {
      prompt: 'hi there',
      reply: 'hi 👋 ready when you are',
    },
    prompt: 'remember that I prefer terse summaries and always cite sources',
    toolStream: [
      { tool: 'memory.read', args: '/agent/persona', status: 'ok' },
      { tool: 'memory.save', args: '/user/feedback/style', status: 'ok' },
      { tool: 'chain.send', args: 'iNFT.update(slot, cid)', status: 'ok' },
    ],
    reply: `Saved.

**Preference**: terse summaries, always cite sources
Filed under /user/feedback/style

Encrypted client-side, pinned to IPFS, and the CID digest anchored in the iNFT memory slot on Arbitrum. It survives this session and follows the token if you ever transfer me.

Tx: sepolia.arbiscan.io/tx/0x771a…c8e0`,
    artifact: {
      type: 'note',
      path: '/user/feedback/style',
      cid: 'bafybeid428f17b6c93a04e',
      slot: 'memory-index',
      txHash: '0x771a8e44c0d3294411fefc7b87c8e0',
    },
    painting: 'tower',
    // last provenance station fires at 7000ms (st-anchor) + ~3000ms outcome hold
    durationMs: 10000,
  },
]
