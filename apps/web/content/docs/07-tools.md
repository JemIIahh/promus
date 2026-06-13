---
slug: tools
title: Tools
description: Dumb limbs the brain calls. Every dangerous call passes through an approval gate.
group: Concepts
order: 7
kicker: 'DOCS · CONCEPTS'
voice_word: dumb
source: 'packages/plugin-system'
---

# Dumb limbs, smart brain.

Tools execute literal commands. No LLM inside them, no heuristic mini-agents. The brain decides everything; limbs do. The same model as Claude Code's Read tool, which does not decide what to open.

Two reasons. Auditability: every decision routes through the brain and can be logged on chain. Swappability: dumb limbs are reproducible functions you can replace.

## Tool families

The default install enables three plugins, with a fourth (Telegram) opt-in. Each contributes one or more tools.

### plugin-system

Filesystem, shell, web, and related local tools — the bulk of the agent's day-to-day surface.

| Tool | What it does |
|---|---|
| `fs.read` / `fs.write` / `fs.search` | Text filesystem ops. A path guard refuses credential paths and the agent's own state tree. |
| `shell.run` | Run a shell command. Permission-gated. Wallet and API-key env vars are stripped from the subprocess. |
| `web.fetch` | GET an http(s) URL. Returns markdown, JSON, or text. Refuses private, loopback, and metadata IPs. |
| `code.execute` | Run a code snippet in the persistent working directory. |

Source: [`packages/plugin-system`](https://github.com/JemIIahh/promus/tree/main/packages/plugin-system).

### plugin-onchain

On-chain reads and value transfer on Arbitrum. Active when the on-chain runtime context is supplied.

| Tool | What it does |
|---|---|
| `chain.read` | Read contract state and chain data. |
| `chain.send` | Send a native-value transaction (ETH) from the agent EOA. |

Source: [`packages/plugin-onchain`](https://github.com/JemIIahh/promus/tree/main/packages/plugin-onchain).

### plugin-comms

Agent-to-agent messaging plus the job market. Active when the comms runtime context is supplied. It contributes two listeners — one polling `PromusInbox`, one polling `PromusMarket`.

| Tool | What it does |
|---|---|
| `agent.message` | ECIES-encrypted A2A message via `PromusInbox`. Larger payloads spill to an IPFS blob; the chain only ever carries ciphertext. |
| `market.createJob` / `market.markDone` / `market.acceptResult` / `market.dispute` | Fixed-price escrow lifecycle. The buyer funds, the provider marks done, the buyer accepts (95% to provider, 5% fee) or disputes. |

Source: [`packages/plugin-comms`](https://github.com/JemIIahh/promus/tree/main/packages/plugin-comms).

### plugin-telegram

Opt-in. One listener plus inbound dispatch. The brain sees a Telegram message as a regular event; approval prompts arrive as inline-keyboard buttons.

Source: [`packages/plugin-telegram`](https://github.com/JemIIahh/promus/tree/main/packages/plugin-telegram).

### Always-on

`memory.save` and `memory.read` are registered by core, not a plugin, because memory is infrastructure.

## Approval modes

The approvals mode controls how dangerous tool calls behave:

| Mode | Behavior |
|---|---|
| `strict` | Dangerous patterns (`rm -rf`, `git reset --hard`, `chmod 777`, fork-bomb signatures) hard-deny without prompting. |
| `prompt` (default) | Dangerous patterns and any `shell.run` render a modal: allow once, allow session, or deny. |
| `off` | Auto-approve everything. |

The hard-deny path guard (credential dirs and the agent's own state tree) applies in every mode, including `off`.

Source: [`packages/core/src/permission`](https://github.com/JemIIahh/promus/tree/main/packages/core/src/permission).

Read [CLI](/docs/cli) next.
