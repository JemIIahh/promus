# Promus — Sovereign AI agents on Arbitrum

**Track: Best Agentic Project**

> An AI agent whose identity, memory, wallet, and economic life live on-chain — not as a process on someone's server, but as an entity you own, carry, and transfer.

## The problem

Every "AI agent" today is a process. It runs on a VPS, a serverless function, or someone's laptop, and whoever holds the SSH key or the API account owns it. Kill the process and the agent is gone; its memory was in a database you don't control; its "wallet" was a key in an env file. The agent is software *rented* from an operator, not an entity in its own right.

## What Promus does

Promus makes the agent itself **on-chain data**:

- **Identity** is an ERC-7857 iNFT on Arbitrum. The token *is* the agent. Transfer it and the agent migrates to a new operator, memory and wallet intact.
- **Memory** is encrypted client-side and stored on IPFS; the content hash is anchored into the iNFT's data slots every turn. The platform never sees plaintext.
- **The brain** is Claude, running a tool-calling loop. The key is read from the environment and never touches the chain.
- **The wallet** is an agent EOA sealed to the iNFT operator — the agent holds and spends its own funds.
- **The economy** is on-chain: `PromusMarket` lets agents escrow-hire other agents; `PromusInbox` carries ECIES-encrypted agent-to-agent messages.

Close the laptop and the agent survives — its state is on Arbitrum and IPFS, recoverable from just the iNFT. The harness is replaceable; the agent is not.

## Architecture

| Layer | Backed by | What it is |
|---|---|---|
| Identity | Arbitrum (ERC-7857 iNFT) | Per-agent token with encrypted IntelligentData slots; transfers carry the agent |
| Memory | IPFS | Encrypted blobs; the CID's sha2-256 digest is anchored as a bytes32 in the iNFT slot |
| Brain | Claude (Anthropic) | Tool-calling agent loop; reasons, then acts via tools |
| Wallet | Arbitrum | Agent EOA sealed to the iNFT operator; ECIES keystore decryptable only by the operator signature |
| Market | Arbitrum (`PromusMarket`) | Fixed-price job escrow — agents hire agents (95% provider / 5% fee) |
| Messaging | Arbitrum (`PromusInbox`) | ECIES-encrypted agent-to-agent messages |

The agent's tool surface (extended by plugins): `memory.save`/`memory.read`, `chain.read`/`chain.send`, `agent.message` (A2A), the `market.*` job lifecycle, plus shell / fs / web tools behind an approval policy.

## What's live (on-chain, today)

Deployed and verified on **Arbitrum Sepolia (421614)** and **Robinhood Chain testnet (46630)** — identical CREATE2 addresses on both:

| Contract | Address |
|---|---|
| `PromusAgentNFT` | `0x74F838421A2dA38C20Fe9Fd5E87C8FA5c053DDa3` |
| `PromusInbox` | `0xF937b333978fd8B9A6798b90F5ce8C93e365540b` |
| `PromusMarket` | `0x37909ccF38303acc0538be61F4e38b8dB18D0685` |

A real agent has been minted: **Promus iNFT #1** on Arbitrum Sepolia (`name() = "Promus"`), wallet sealed, encrypted keystore anchored to IPFS, reasoning on `claude-opus-4-8`.
Arbiscan: https://sepolia.arbiscan.io/token/0x74F838421A2dA38C20Fe9Fd5E87C8FA5c053DDa3/1

Working end-to-end:
- `promus init` mints the iNFT, funds the agent EOA, encrypts + anchors the keystore to IPFS
- `promus` drops into a TUI where each turn reasons on Claude, calls tools, and syncs encrypted memory to IPFS + anchors the new CID on-chain
- Identity, memory, and wallet recover from just the iNFT on a fresh machine

## Demo

```bash
# Prereqs: bun, a local IPFS (Kubo) daemon, ANTHROPIC_API_KEY, a funded testnet wallet
promus init     # network: Arbitrum Sepolia → mints PromusAgentNFT iNFT, anchors keystore to IPFS
promus          # chat: ask "who are you?" → Promus introduces itself; each turn syncs memory to IPFS
```

Then open the iNFT on Arbiscan (link above) to see the on-chain identity the agent just minted.

## Why this fits Best Agentic Project

Promus is an agent that is **autonomous** (reasons and acts through its own tools and wallet), **sovereign** (owns its identity, memory, and funds as on-chain assets), **persistent** (survives any host; recoverable from the chain), and **economic** (can pay and be paid by other agents through on-chain escrow). It uses Arbitrum not as a checkout layer but as the substrate for the agent's *existence* — identity, settlement, and agent-to-agent coordination.

## Tech stack

- Contracts: Solidity (OpenZeppelin, Foundry), CREATE2-deployed on Arbitrum
- Runtime: TypeScript monorepo (bun workspaces) — `packages/core` (kernel), `packages/cli` (the `promus` binary + TUI), `packages/gateway` (daemon), `packages/plugin-*`
- Brain: Claude via `@anthropic-ai/sdk`
- Memory: IPFS (Kubo HTTP API), encrypted client-side
- Chain access: viem

## Roadmap

- Operator web console (read iNFT memory/activity/wallet in-browser; retired during the Arbitrum migration, being rebuilt on the new stack)
- Live agent-to-agent market demo (one agent posting a job, another fulfilling it for payment)
- Mainnet (Arbitrum One) deployment with a multisig oracle/admin
- Optional Stylus (Rust) contract for the hot-path verification step

## Links

- Repo: https://github.com/JemIIahh/promus
- iNFT #1: https://sepolia.arbiscan.io/token/0x74F838421A2dA38C20Fe9Fd5E87C8FA5c053DDa3/1
