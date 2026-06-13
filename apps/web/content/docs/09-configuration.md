---
slug: configuration
title: Configuration
description: One typed config module plus a small set of environment variables.
group: Reference
order: 9
kicker: 'DOCS · REFERENCE'
voice_word: typed
source: 'packages/core/src/config.ts'
---

# One typed config module.

Agent config is a typed TS module that exports `defineConfig({ ... })`. The wizard writes it at init; you can edit it any time. Secrets — the Anthropic key and the IPFS endpoint — stay in the environment, never in the config file.

## Environment

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | The agent's brain. Required. Read at runtime, never on chain. |
| `ANTHROPIC_MODEL` | Optional model override; defaults to a current Claude model. |
| `ANIMA_STORAGE_BACKEND` | `ipfs` (default) or `local` for development. |
| `ANIMA_IPFS_API_URL` | Kubo HTTP API. Local node: `http://127.0.0.1:5001`. |
| `ANIMA_IPFS_GATEWAY` | Read gateway including the trailing `/ipfs`. Local: `http://127.0.0.1:8080/ipfs`. |
| `ANIMA_IPFS_API_TOKEN` | Bearer token only for an authenticated hosted endpoint; blank for local Kubo. |

## Minimal example

```ts
import { defineConfig } from 'promus-core'

export default defineConfig({
  network: 'arbitrum-sepolia',
  identity: {
    iNFT: {
      contract: '0x74F838421A2dA38C20Fe9Fd5E87C8FA5c053DDa3',
      tokenId: '42',
      network: 'arbitrum-sepolia',
    },
    operator: '0xOPERATOR...',
    agent: '0xAGENT...',
  },
  plugins: ['onchain', 'comms', 'system'],  // add 'telegram' to enable the bridge
})
```

`network` is required. Everything else has defaults.

## Top-level keys

| Key | Type | Default | What it controls |
|---|---|---|---|
| `network` | `PromusNetwork` | required | Chain for identity and on-chain reads. |
| `storage.network` | `PromusNetwork` | mirrors `network` | Which network's storage context to use. |
| `identity.iNFT` | ref or `null` | `null` | Once minted, holds `{ contract, tokenId, network }`. |
| `identity.operator` | string or `null` | `null` | Wallet that owns the iNFT. |
| `identity.agent` | string or `null` | `null` | Agent EOA address. |
| `brain.model` | string or `null` | `null` | Optional model pin (otherwise the env / runtime default applies). |
| `brain.maxOutputTokens` | number | `4096` | Assistant output cap per turn. |
| `brain.contextWindow` | number | model-dependent | Used by the compaction trigger. |
| `brain.compaction` | object or `null` | `{ threshold: 0.5, keepRecent: 8 }` | Pre-flight summarize-fold of older history. |
| `plugins` | `PromusPlugin[]` | `['onchain','comms','system']` | Which plugins to load. Add `'telegram'`. |
| `tools` | `Record<string, boolean>` | `{}` | Glob-level allow/deny. Right-most match wins. |
| `imports.claudeCode` | boolean | `true` | Inherit skills, plugins, and MCP from `~/.claude/`. |
| `approvals.mode` | `'strict' \| 'prompt' \| 'off'` | `'prompt'` | Permission gate behavior. |
| `skills.disabled` | `string[]` | `[]` | Skill ids never to auto-load or index. |

## Networks

| Network | Chain ID | RPC | Native token |
|---|---|---|---|
| `arbitrum-sepolia` | 421614 | `https://sepolia-rollup.arbitrum.io/rpc` | ETH |
| `robinhood-testnet` | 46630 | `https://rpc.testnet.chain.robinhood.com` | ETH |

`PromusAgentNFT`, `PromusInbox`, and `PromusMarket` are CREATE2-deployed, so they share the same address on both chains. Canonical addresses live in `packages/core/src/identity/deployments.ts`.

## Tool toggles

Globs apply right-to-left; specific keys win over broader keys:

```ts
tools: {
  'shell.*': false,   // disable every shell tool
  'shell.run': true,  // ...except shell.run
  'web.fetch': true,
}
```

A tool blocked at the config layer never appears in the tool list the brain sees. A tool allowed at config still passes through the permission gate at call time.

Read [Console](/docs/console) next.

Source: [`packages/core/src/config.ts`](https://github.com/JemIIahh/promus/blob/main/packages/core/src/config.ts), [`packages/core/src/identity/deployments.ts`](https://github.com/JemIIahh/promus/blob/main/packages/core/src/identity/deployments.ts).
