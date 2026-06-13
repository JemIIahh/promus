/**
 * Provenance ledger entries , what actually happened beneath each cycle
 * (wallet, brain, memory, chain, comms, market). The right-side hero
 * canvas renders these as commentary on the left-side chat.
 *
 * The narration is the headline: a plain-English sentence a non-crypto
 * reader can grasp in 2 seconds. The proof is small mono evidence
 * underneath. Hashes are stylized to look like real Arbitrum tx /
 * signers / IPFS CIDs.
 */

export type StampKind =
  | 'wallet'
  | 'attestation'
  | 'sandbox'
  | 'storage'
  | 'chain'
  | 'inbox'
  | 'market'

/**
 * Tool-specific animated glyph kind. Each one renders a small SVG icon
 * inside the station node , the icon ANIMATES on station activation
 * (the line draws itself, the lock shackle closes, etc.) so the moment
 * of the action firing is visible.
 */
export type GlyphKind =
  | 'sign'
  | 'brain'
  | 'browser'
  | 'lock'
  | 'anchor'
  | 'swap'
  | 'stake'
  | 'message'
  | 'gavel'

export type Receipt = {
  id: string
  /** Tool-specific animated glyph for the station node. */
  glyph: GlyphKind
  /** Legacy big-stamp kind , kept for cycles that haven't been migrated. */
  stamp?: StampKind
  /** Title-cased display label rendered in the right-side panel. */
  layer: 'You' | 'Brain' | 'Limbs' | 'Memory' | 'Chain' | 'Comms' | 'Commerce'
  /** Plain-English sentence that EXPLAINS what just happened. */
  narration: string
  /** Optional explorer link , when set, renders a "verify on chain ↗" link below the narration. */
  proofHref?: string
  delayMs: number
}

export type Provenance = {
  /** One-line frame for the whole right panel for this cycle. */
  intro: string
  outcome: string
  receipts: Receipt[]
}

// Real Promus contract addresses on Arbitrum Sepolia. Each `proofHref`
// points at the arbiscan /address/ page for the contract that actually
// settles the station's action , clicking it shows real on-chain
// activity, not a stylized fake hash. Mirrors
// packages/core/src/identity/deployments.ts.
const ARBISCAN_ADDR = 'https://sepolia.arbiscan.io/address/'
const PROMUS_AGENT_NFT = '0x74F838421A2dA38C20Fe9Fd5E87C8FA5c053DDa3'
const PROMUS_INBOX = '0xF937b333978fd8B9A6798b90F5ce8C93e365540b'
const PROMUS_MARKET = '0x37909ccF38303acc0538be61F4e38b8dB18D0685'

const INTRO = 'every step above leaves a trail on Arbitrum'

// ─── per-cycle provenance ──────────────────────────────────────────────
//
// All cycles follow a 5-station voyage synced to the left-side chat:
//   1. You      , wallet signs the intent
//   2. Brain    , Claude reasons + drafts the plan
//   3. [action] , the cycle's headline beat (limbs / chain / comms+market)
//   4. Memory   , receipt encrypted client-side + pinned to IPFS
//   5. Chain    , CID digest sealed into the iNFT (omitted for cycle 3, where
//                 the gavel beat IS the chain finale)
//
// `delayMs` for each station is hand-tuned to fire just after the matching
// left-side moment lands. See TuiCanvas.tsx + TgCanvas.tsx for the left-side
// timing constants. `cycle.durationMs` in lib/cycles.ts is derived as
// `last_station_delayMs + ~3000ms outcome hold`.

export const PROVENANCE: Record<string, Provenance> = {
  // ─── Cycle 1 , TUI · research ────────────────────────────────────────
  // TuiCanvas: commit at 2800, tools start at 2800 stagger 700ms each, last
  // tool (memory.save, idx 5) at 6300, reply at 7600.
  research: {
    intro: INTRO,
    outcome: 'Note saved to /user/learned/erc-7857',
    receipts: [
      {
        id: 'r-sign',
        glyph: 'sign',
        stamp: 'wallet',
        layer: 'You',
        narration: 'Your prompt stayed local; only the agent acts on chain on your behalf.',
        delayMs: 2700, // just after `you · …` row commits
      },
      {
        id: 'r-attest',
        glyph: 'brain',
        stamp: 'attestation',
        layer: 'Brain',
        narration:
          'Claude reasoned over the task and chose which tools to call, one step at a time.',
        delayMs: 3100, // as "thinking…" appears
      },
      {
        id: 'r-browser',
        glyph: 'browser',
        stamp: 'sandbox',
        layer: 'Limbs',
        narration:
          'Browser and web tools fetched the sources. The limbs only execute; the brain decides.',
        delayMs: 3500, // first tool block visible
      },
      {
        id: 'r-storage',
        glyph: 'lock',
        stamp: 'storage',
        layer: 'Memory',
        narration: 'The note was encrypted client-side and pinned to IPFS as a content-addressed blob.',
        delayMs: 6700, // memory.save tool block lands
      },
      {
        id: 'r-chain',
        glyph: 'anchor',
        stamp: 'chain',
        layer: 'Chain',
        narration:
          "The blob's CID digest was sealed into the agent's iNFT, so the proof survives operator handoff.",
        proofHref: ARBISCAN_ADDR + PROMUS_AGENT_NFT,
        delayMs: 9000, // ~1.4s after reply lands
      },
    ],
  },

  // ─── Cycle 2 , TG · transfer ─────────────────────────────────────────
  // TgCanvas: greeting 200/800/1500, main user at 2400, think at 3000,
  // tools at 3800 stagger 380ms each. chain.send (idx 2) lands at 4560.
  // memory.save (idx 3) at 4940. Reply at 5940.
  transfer: {
    intro: INTRO,
    outcome: '0.01 ETH sent · receipt saved to /user/treasury',
    receipts: [
      {
        id: 's-sign',
        glyph: 'sign',
        stamp: 'wallet',
        layer: 'You',
        narration: 'You asked once; the agent signs from its own sealed wallet, not yours.',
        delayMs: 2500, // main user prompt commits
      },
      {
        id: 's-attest',
        glyph: 'brain',
        stamp: 'attestation',
        layer: 'Brain',
        narration: 'Claude resolved the recipient and confirmed the balance before drafting the send.',
        delayMs: 3100, // think bubble visible
      },
      {
        id: 's-chain-send',
        glyph: 'swap',
        stamp: 'chain',
        layer: 'Chain',
        narration:
          'The transfer settled as a real on-chain transaction from the agent EOA on Arbitrum.',
        proofHref: ARBISCAN_ADDR + PROMUS_AGENT_NFT,
        delayMs: 5000, // chain.send tool ✓ confirms
      },
      {
        id: 's-storage',
        glyph: 'lock',
        stamp: 'storage',
        layer: 'Memory',
        narration: 'The receipt was encrypted client-side and pinned to IPFS for your records.',
        delayMs: 6000, // memory.save tool ✓ confirms
      },
      {
        id: 's-anchor',
        glyph: 'anchor',
        stamp: 'chain',
        layer: 'Chain',
        narration:
          "The CID digest was sealed into the agent's iNFT, so the receipt survives operator handoff.",
        proofHref: ARBISCAN_ADDR + PROMUS_AGENT_NFT,
        delayMs: 7500, // ~1.2s after reply lands
      },
    ],
  },

  // ─── Cycle 3 , TUI · commerce ────────────────────────────────────────
  // TuiCanvas: commit at 2800, tools at 2800 stagger 700ms.
  // agent.message (idx 1) at 3500. market.acceptResult (idx 3) at 4900.
  // memory.save (idx 4) at 5600. Reply at 7000. No anchor station: the
  // gavel IS the chain finale here (escrow released on chain).
  commerce: {
    intro: INTRO,
    outcome: 'auditor agent hired · log saved to /user/audits',
    receipts: [
      {
        id: 'c-sign',
        glyph: 'sign',
        stamp: 'wallet',
        layer: 'You',
        narration: 'You set the budget; the agent negotiates and pays from its own wallet.',
        delayMs: 2900, // just after commit
      },
      {
        id: 'c-attest',
        glyph: 'brain',
        stamp: 'attestation',
        layer: 'Brain',
        narration: 'Claude browsed the market, picked an auditor, and drafted the encrypted brief.',
        delayMs: 3300, // just before tools
      },
      {
        id: 'c-inbox',
        glyph: 'message',
        stamp: 'inbox',
        layer: 'Comms',
        narration:
          'The brief traveled through PromusInbox as an ECIES envelope. Only the auditor could open it.',
        proofHref: ARBISCAN_ADDR + PROMUS_INBOX,
        delayMs: 4400, // agent.message tool ✓
      },
      {
        id: 'c-market',
        glyph: 'gavel',
        stamp: 'market',
        layer: 'Commerce',
        narration:
          'PromusMarket released the escrow on chain the moment the audit report was accepted.',
        proofHref: ARBISCAN_ADDR + PROMUS_MARKET,
        delayMs: 5800, // market.acceptResult tool ✓
      },
      {
        id: 'c-storage',
        glyph: 'lock',
        stamp: 'storage',
        layer: 'Memory',
        narration: "The audit log was encrypted and filed under the agent's memory on IPFS.",
        delayMs: 6700, // memory.save tool ✓
      },
    ],
  },

  // ─── Cycle 4 , TG · memory ───────────────────────────────────────────
  // TgCanvas: greeting 200/800/1500, main user at 2400, think at 3000,
  // tools at 3800 stagger 380ms. chain.send (idx 2) at 4560. Reply at
  // ~5180.
  memory: {
    intro: INTRO,
    outcome: 'Preference saved to /user/feedback/style and anchored on chain',
    receipts: [
      {
        id: 'st-sign',
        glyph: 'sign',
        stamp: 'wallet',
        layer: 'You',
        narration: 'A plain request; the agent decides where the fact belongs in its memory.',
        delayMs: 2500, // main user prompt commits
      },
      {
        id: 'st-attest',
        glyph: 'brain',
        stamp: 'attestation',
        layer: 'Brain',
        narration:
          'Claude read its persona, then wrote the preference to the right memory partition.',
        delayMs: 3100, // think bubble visible
      },
      {
        id: 'st-storage',
        glyph: 'lock',
        stamp: 'storage',
        layer: 'Memory',
        narration: 'The note was encrypted client-side and pinned to IPFS as a content-addressed blob.',
        delayMs: 4200, // memory.save tool ✓
      },
      {
        id: 'st-anchor',
        glyph: 'anchor',
        stamp: 'chain',
        layer: 'Chain',
        narration:
          "The CID digest was sealed into the agent's iNFT memory slot, so the fact survives operator handoff.",
        proofHref: ARBISCAN_ADDR + PROMUS_AGENT_NFT,
        delayMs: 6500, // chain.send / iNFT.update tool ✓
      },
    ],
  },
}
