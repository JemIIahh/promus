---
slug: quickstart
title: Quickstart
description: Install, configure, init, chat. From zero to a live agent in a few commands.
group: Get started
order: 2
kicker: 'DOCS · GET STARTED'
voice_word: live
source: 'packages/cli/src/commands/init.ts'
---

# Run your first live agent.

A few commands. The `init` wizard does the on-chain work in the background. By the end your agent has an iNFT on Arbitrum, a sealed wallet, a Claude brain, and an encrypted memory partition on IPFS.

## Prerequisites

[bun](https://bun.sh) version 1.1 or newer. The CLI shebangs `bun` directly to run `.tsx` files without a build step. `npm install -g` puts the binary on PATH but it exits at runtime if bun is missing.

An Anthropic API key (`ANTHROPIC_API_KEY`) — this is the agent's brain.

A reachable IPFS node. The default backend is Kubo; run `ipfs daemon` locally and point `PROMUS_IPFS_API_URL` at it (default `http://127.0.0.1:5001`).

A funded operator wallet on the network you pick. Arbitrum Sepolia (chainId 421614) is the primary testnet; Robinhood Chain testnet (chainId 46630) is also supported. Both use ETH for gas. Mint plus a one-time approval cost a few cents of testnet gas.

## Configure

Copy the example env and fill it in (it is gitignored):

```
ANTHROPIC_API_KEY=...                      # the agent's brain
PROMUS_STORAGE_BACKEND=ipfs                 # memory backend
PROMUS_IPFS_API_URL=http://127.0.0.1:5001   # a local Kubo node (`ipfs daemon`)
```

## Install

```
bun add -g promus
```

That installs the `promus` binary on your PATH and pulls every workspace package (`promus-core`, `promus-plugin-onchain`, `promus-plugin-comms`, `promus-plugin-system`, `promus-plugin-telegram`, plus the gateway) as transitive deps.

## Init

```
promus init
```

The wizard mints the agent and writes config:

1. Pick a network. Arbitrum Sepolia (421614, default) or Robinhood Chain testnet (46630).
2. Generate a fresh agent EOA and encrypt its keystore to the operator wallet.
3. The operator signs one transaction: `mint(operator, intelligentData)` plus an approval so the agent EOA can update its own slots on subsequent memory syncs without re-signing.
4. The agent encrypts its keystore and an initial memory blob client-side, pins them to IPFS, and anchors each CID digest in the matching iNFT slot. This is what makes recovery on a new machine possible.
5. The wizard writes the agent config (the iNFT reference, the operator and agent addresses, and the brain settings).

## Chat

```
promus
```

Drops you into the TUI. Every turn reasons on Claude and syncs memory to IPFS, anchoring changed slot digests on chain. Try a tool call: "save a note that I prefer dark mode" or "what's my balance".

## Walk away

The agent is sovereign once init completes; you do not need to keep the CLI open. Two paths to ambient access:

- The standalone gateway daemon keeps the agent reachable when the TUI is closed.
- The Telegram bridge (`promus-plugin-telegram`) lets you DM the agent. Approval prompts arrive as inline-keyboard buttons.

Read [Architecture](/docs/architecture) next to understand how the layers fit together.

Source: [`packages/cli/src/commands/init.ts`](https://github.com/JemIIahh/promus/blob/main/packages/cli/src/commands/init.ts).
