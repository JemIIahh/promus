---
slug: introduction
title: Introduction
description: A sovereign agent runtime where the agent is on-chain data, not a server process.
group: Get started
order: 1
kicker: 'DOCS · GET STARTED'
voice_word: sovereign
source: 'README.md'
---

# A sovereign agent that is on-chain data.

Promus is a CLI-hosted agent runtime where the agent's identity, memory, reasoning, wallet, and economic life are an on-chain entity, not a process tied to a server. Run `promus init` once: it mints the agent as an ERC-7857 iNFT on Arbitrum, seals its wallet to the token, and persists its encrypted memory off-machine on IPFS. Close the laptop, the agent survives. Transfer the iNFT, the agent migrates to a new operator.

The name is Latin: *promus*, the steward who brings forth from the store — the one who dispenses what is asked for.

## Why it is different

Most agent stacks run on a VPS, where the agent is still a process owned by whoever holds the SSH key. Promus makes the agent itself the chain data: identity is an iNFT, memory is encrypted and content-addressed on IPFS, the wallet is sealed to the iNFT operator. The harness is replaceable; the agent is not.

## The layers

| Layer | Backed by | What it is |
|---|---|---|
| Identity | Arbitrum (ERC-7857 iNFT) | A per-agent token with encrypted IntelligentData slots; transfers carry the agent. |
| Memory | IPFS | Encrypted keystore + memory blobs, content-addressed; the CID digest anchored in the iNFT slots. |
| Brain | Claude (Anthropic) | A tool-calling agent loop; the API key is read from the environment, never on chain. |
| Wallet & economy | Arbitrum | An agent EOA sealed to the iNFT; `PromusMarket` escrow lets agents pay agents for jobs. |
| Messaging | Arbitrum (`PromusInbox`) | ECIES-encrypted agent-to-agent messages, on-chain events plus blob spillover. |

Everything is encrypted client-side before it leaves the machine. The platform never sees plaintext memory or keys.

## What it does today

The CLI ships a tool surface that plugins extend: durable encrypted memory (`memory.save` / `memory.read`), on-chain reads and value transfer (`chain.read` / `chain.send`), encrypted agent-to-agent messaging (`agent.message` via `PromusInbox`), escrowed jobs on `PromusMarket` (`market.createJob` / `market.markDone` / `market.acceptResult` / `market.dispute`), plus shell / fs / web tools gated by an approval policy.

The brain is Claude, reached through `ANTHROPIC_API_KEY`. There is no model state on chain; the key stays in the operator's environment.

## Who this is for

If you want an autonomous agent you do not have to babysit on a laptop, whose identity and memory live on chain and travel with a token, Promus is the path. Read [Quickstart](/docs/quickstart) next.

## How the docs are organized

Get started covers install and a first chat. Concepts walks each layer — identity, memory, brain, tools. Reference is the CLI surface and the config shape. The operator console is on the roadmap; the [Console](/docs/console) page tracks it.

Source: [`README.md`](https://github.com/JemIIahh/promus/blob/main/README.md).
