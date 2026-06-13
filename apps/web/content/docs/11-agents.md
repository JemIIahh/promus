---
slug: agents
title: For Agents
description: How AI agents (Claude Code, Codex, Cursor) install and operate Promus for a human user. What works headless, what does not, what to never claim.
group: Reference
order: 11
kicker: 'DOCS · REFERENCE'
voice_word: honest
source: 'apps/web/content/docs/11-agents.md'
---

# An honest guide for AI agents.

You are an LLM. A human asked you to install Promus. This page tells you exactly what you can do for them, what you must hand back, and what you should never claim. The goal is fewer hallucinated assumptions and fewer hung scripts.

If you only read one line: **bun is required, the agent needs an `ANTHROPIC_API_KEY` and a reachable IPFS node, and `promus init` is interactive (no stdin piping; puppet it in tmux or guide the user).**

## The install gotcha that bites every agent

The CLI ships with the shebang `#!/usr/bin/env bun`. When a user runs `npm install -g promus`, the install step succeeds and a working `promus` binary lands on PATH. The next time the binary runs, the OS resolves the shebang and exits with `env: bun: No such file or directory`.

Install bun first. Always.

```
curl -fsSL https://bun.sh/install | bash
bun add -g promus
promus init
```

The package and the binary are both `promus`. Requires bun >= 1.1. Run `promus --version` so you know the surface you are working against.

## What the agent needs before init

- `ANTHROPIC_API_KEY` in the environment — the brain.
- A reachable IPFS (Kubo) node, with `PROMUS_IPFS_API_URL` pointing at it — the memory backend. Locally: `ipfs daemon`.
- A funded operator wallet on the target network (Arbitrum Sepolia 421614, or Robinhood Chain testnet 46630). Both use ETH for gas.

## What you can do for the user

- Install the package (`bun add -g promus`) and bun itself if missing.
- Set up `ANTHROPIC_API_KEY` and the IPFS env vars in the user's environment.
- Read and write the agent config. The type is `defineConfig` from `promus-core`. See [Configuration](/docs/configuration).
- Explain commands. The most-used are `promus init`, `promus` (TUI), `promus status`, `promus logs --tail N`, `promus inspect`.
- Inspect on-chain state with `promus inspect [ref]`, including foreign iNFTs in raw mode. See [Identity](/docs/identity).

## How to drive init

`promus init` is interactive. Two paths:

**Path A: guide the human.** Walk the user through each prompt. Right if you have no shell access.

**Path B: puppet the TUI.** With `tmux` (or another pty-capable wrapper) on the operator's machine, drive init end to end: spawn `promus init` in a pane, `tmux capture-pane` to read each prompt, decide, `tmux send-keys` to answer. The wizard does not detect the puppeteer because keystrokes arrive through a real pty.

Naive piping (`echo y | promus init`, `expect` scripts that write to stdin) hangs on the first prompt because the prompt library checks for a real TTY.

## One-shot chat does not exist

There is no non-TUI chat mode. `promus` and `promus chat` both drop into a TUI; the brain runs per turn while the TUI is open or the gateway daemon is running. To ask one question and exit, drive the TUI in tmux or reach the gateway daemon.

## Anti-patterns to avoid

- **Do NOT** claim the agent works without `ANTHROPIC_API_KEY`. The brain is Claude; no key, no agent.
- **Do NOT** claim memory works without a reachable IPFS node. Memory is encrypted blobs pinned to IPFS, with the CID digest anchored on chain.
- **Do NOT** vary contract addresses by network. `PromusAgentNFT`, `PromusInbox`, and `PromusMarket` are CREATE2-deployed, so Arbitrum Sepolia (421614) and Robinhood Chain testnet (46630) share the same addresses.
- **Do NOT** default to a network without telling the user it costs gas. Both supported networks are testnets and use ETH.
- **Do NOT** script destructive operations (`promus drain`) without explicit user confirmation.

## Where state lives

A clean install creates `~/.promus/` with per-agent state: the operator-encrypted keystore, a local cache of IPFS data, the memory partitions (`agent/` travels with the iNFT, `user/` is operator-scoped), runtime state, and the gateway socket when running. The `~/.promus` path and the `PROMUS_` env prefix are unchanged runtime details.

## Machine-readable surfaces

- [/llms.txt](/llms.txt): index with one bullet per doc, the install line, and contract addresses. Fetch this first.
- [/llms-full.txt](/llms-full.txt): single-file dump of every doc plus the README.
- [/docs/<slug>.md](/docs/agents.md): raw markdown per page (e.g. `/docs/quickstart.md`, `/docs/cli.md`).

Re-fetch before relying on cached prior advice.
