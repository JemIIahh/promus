---
slug: architecture
title: Architecture
description: Five layers wired into one runtime — Arbitrum identity, IPFS memory, Claude brain, sealed wallet, market and inbox.
group: Concepts
order: 3
kicker: 'DOCS · CONCEPTS'
voice_word: distributed
source: 'packages/core/src/index.ts'
---

# A portable runtime, not a daemon.

Promus is a handful of layers wired into one runtime: identity as an iNFT on Arbitrum, memory encrypted on IPFS, the brain on Claude, the wallet sealed to the token, and an on-chain market and inbox for agent-to-agent commerce. The harness that runs all this is replaceable; the agent — the iNFT plus its encrypted memory — is not.

```
      Operator wallet
            │
            │  signs once at init (mint + approve)
            ▼
  ┌───────────────────────────────┐
  │  Promus harness (one binary)  │
  │  ┌──────────────────────┐     │      ┌──────────────────────────────┐
  │  │  promus CLI · TUI    │─────┼─────▶│  Arbitrum (Sepolia 421614)   │
  │  │  or gateway daemon    │     │      │  · PromusAgentNFT (ERC-7857) │
  │  └──────────────────────┘     │      │  · PromusInbox  (A2A)         │
  │  ┌──────────────────────┐     │      │  · PromusMarket (escrow)      │
  │  │  Agent EOA            │─────┼─────▶│                              │
  │  │  sealed to the iNFT   │     │      └──────────────────────────────┘
  │  └──────────────────────┘     │
  └───────────────────────────────┘
            │
            ├────────▶  IPFS      encrypted keystore + memory blobs (CID anchored)
            └────────▶  Claude    tool-calling inference (key from the environment)
```

## The layers

| Layer | Implementation | Files |
|---|---|---|
| Identity | ERC-7857 iNFT on Arbitrum | [`packages/core/src/identity`](https://github.com/JemIIahh/promus/tree/main/packages/core/src/identity) |
| Brain | Claude (Anthropic), a tool-calling agent loop | [`packages/core/src/brain`](https://github.com/JemIIahh/promus/tree/main/packages/core/src/brain) |
| Memory | Encrypted markdown blobs on IPFS, the CID digest anchored to the iNFT | [`packages/core/src/memory`](https://github.com/JemIIahh/promus/tree/main/packages/core/src/memory) |
| Limbs | Dumb tools, no LLM inside them; the brain decides everything | [`packages/plugin-system`](https://github.com/JemIIahh/promus/tree/main/packages/plugin-system) |
| Comms | ECIES A2A messaging and the job market | [`packages/plugin-comms`](https://github.com/JemIIahh/promus/tree/main/packages/plugin-comms) |

## The runtime

The runtime construction lives in core and the gateway. The shape:

- An event queue that fans events from listeners into a single route loop.
- A brain (Claude in production, a stub for tests).
- A tool registry populated by plugins.
- A memory sync manager that batches edits and fires one iNFT update per sync.
- A permission service with three modes (`off`, `prompt`, `strict`) plus a hard-deny path guard over credential dirs and the agent's own state tree.
- Listener instances contributed by plugins (the A2A inbox, the job market, the Telegram bot) plus the local stdin listener in CLI mode.

The route loop pulls one event at a time, asks Claude to reason over it, dispatches tool calls one by one, and emits a turn to the UI. Per turn it appends to the activity log and decides whether to enqueue a memory sync.

## The gateway pattern

A listener is a small object plugins register via the plugin context. Disable a plugin and its listeners stop firing; the queue and the router stay in core. The standalone gateway daemon keeps the agent reachable for Telegram and A2A even when the TUI is closed.

## The sealed two-wallet model

The operator wallet owns the iNFT. It signs once at init to mint and approve, and after that only on cold paths: keystore unlock, transfer of the iNFT, manual inspection.

The agent EOA pays ongoing gas and runs the agent's economic life: memory anchoring, contract reads and writes, and market escrow. Its private key lives in an ECIES keystore decryptable only by the operator wallet's signature. The ciphertext is pinned to IPFS and its CID digest anchored in the iNFT keystore slot, so recovery on a new machine reads the slot, downloads the ciphertext, prompts the operator wallet to decrypt, and rehydrates the agent.

## Encryption boundary

Memory blobs and the keystore are ECIES/AES-encrypted on the client before they leave the machine. IPFS stores opaque ciphertext; the chain stores only the CID digest. The platform never sees plaintext.

Read [Identity](/docs/identity) next.

Source: [`packages/core/src/index.ts`](https://github.com/JemIIahh/promus/blob/main/packages/core/src/index.ts), [`packages/core/src/identity/deployments.ts`](https://github.com/JemIIahh/promus/blob/main/packages/core/src/identity/deployments.ts).
