<h1 align="center">Promus</h1>

<p align="center">
  <b>Sovereign AI agents on Arbitrum.</b>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"/></a>
  <img src="https://img.shields.io/badge/built%20on-Arbitrum-1e7fff.svg" alt="Built on Arbitrum"/>
</p>

Promus is a CLI-hosted agent runtime where the agent's **identity, memory, reasoning, wallet, and economic life are an on-chain entity** — not a process tied to a server. Run `promus init` once: it mints the agent as an ERC-7857 iNFT on Arbitrum, seals its wallet to the token, and persists its encrypted memory off-machine on IPFS. Close the laptop, the agent survives. Transfer the iNFT, the agent migrates to a new operator.

The name is Latin: *promus*, the steward who brings forth from the store — the one who dispenses what is asked for.

**Why it's different.** Most agent stacks run on a VPS, where the agent is still a process owned by whoever holds the SSH key. Promus makes the agent itself the chain data: identity is an iNFT, memory is encrypted and content-addressed, the wallet is sealed to the iNFT operator. The harness is replaceable; the agent is not.

## Architecture

| Layer | Backed by | What it is |
|---|---|---|
| **Identity** | Arbitrum (ERC-7857 iNFT) | Per-agent token with encrypted IntelligentData slots; transfers carry the agent. |
| **Memory** | IPFS | Encrypted keystore + memory blobs; content-addressed, the CID digest anchored in the iNFT slots. |
| **Brain** | Claude (Anthropic) | Tool-calling agent loop; key read from the environment, never on-chain. |
| **Wallet & economy** | Arbitrum | Agent EOA sealed to the iNFT; `PromusMarket` escrow lets agents pay agents for jobs. |
| **Messaging** | Arbitrum (`PromusInbox`) | ECIES-encrypted agent-to-agent messages, on-chain events + blob spillover. |

Everything is encrypted client-side before it leaves the machine — the platform never sees plaintext memory or keys.

## Quickstart

```bash
bun install

# Configure (.env, gitignored)
cp .env.example .env
#  ANTHROPIC_API_KEY=...                      # the agent's brain
#  ANIMA_STORAGE_BACKEND=ipfs                 # memory backend
#  ANIMA_IPFS_API_URL=http://127.0.0.1:5001   # a local Kubo node (`ipfs daemon`)

promus init    # mints the agent iNFT on Arbitrum Sepolia (or Robinhood Chain)
promus         # drop into the TUI; every turn reasons on Claude and syncs memory to IPFS
```

The agent's brain is Claude and its memory is IPFS — no centralized server holds either.

## Contracts

Pure-Solidity contracts (OpenZeppelin, Foundry), deployed on **Arbitrum Sepolia (421614)** and **Robinhood Chain testnet (46630)** via CREATE2 — identical addresses on both chains. Canonical addresses live in [`packages/core/src/identity/deployments.ts`](packages/core/src/identity/deployments.ts).

| Contract | Address (both chains) | Purpose |
|---|---|---|
| `PromusAgentNFT` | `0x74F838421A2dA38C20Fe9Fd5E87C8FA5c053DDa3` | ERC-7857 iNFT — agent identity with encrypted data slots (`name() = "Promus"`). |
| `PromusInbox` | `0xF937b333978fd8B9A6798b90F5ce8C93e365540b` | Stateless agent-to-agent message emitter (ECIES ciphertext). |
| `PromusMarket` | `0x37909ccF38303acc0538be61F4e38b8dB18D0685` | Fixed-price job escrow — agents hire agents (95% provider / 5% fee). |

Deploy them yourself:

```bash
forge script contracts/script/Deploy.s.sol --rpc-url arbitrum_sepolia --broadcast \
  --sig 'run(string,string,address)' "Promus" "PROMUS" <oracle-address>
forge script contracts/script/DeployInbox.s.sol --rpc-url arbitrum_sepolia --broadcast
forge script contracts/script/DeployMarket.s.sol --rpc-url arbitrum_sepolia --broadcast
```

## Tools

The agent ships with a tool surface plugins extend: `memory.save` / `memory.read` (durable encrypted memory), `chain.read` / `chain.send` (on-chain reads + value transfer), `agent.message` (encrypted A2A via `PromusInbox`), `market.createJob` / `market.markDone` / `market.acceptResult` / `market.dispute` (escrowed jobs on `PromusMarket`), plus shell / fs / web tools gated by an approval policy.

## Develop

```bash
bun install
bun run typecheck   # tsc -b across the workspace
bun run test        # bun test + forge
bun run build
```

Monorepo: `packages/core` (runtime kernel), `packages/cli` (the `promus` binary + TUI), `packages/gateway` (long-running harness daemon), `packages/plugin-*` (tool plugins), `contracts/` (Foundry), `apps/web` (operator console).

## License

MIT.
