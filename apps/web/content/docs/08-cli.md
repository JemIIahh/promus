---
slug: cli
title: CLI
description: Every promus command, every flag. The CLI is the single orchestration plane.
group: Reference
order: 8
kicker: 'DOCS · REFERENCE'
voice_word: single
source: 'packages/cli/src/commands'
---

# A single orchestration plane.

The `promus` binary owns onboarding, chat, recovery, and admin. Commands are one file per command under `packages/cli/src/commands/`. Most read or write a small piece of agent state; a few orchestrate longer flows like `init`.

## Onboarding

`promus init` runs the wizard described in [Quickstart](/docs/quickstart): pick a network, mint the iNFT, seal the wallet, write config. `--resume` picks up from the first incomplete step.

`promus restore <iNFT-ref>` recovers an agent on a new machine from its iNFT. It reads the keystore slot, downloads the encrypted blob from IPFS, prompts the operator wallet to decrypt, and rehydrates.

## Chat

`promus` (or `promus chat`) drops into the interactive TUI. Every turn reasons on Claude and auto-syncs changed memory to IPFS, anchoring slot digests on chain.

On Telegram (when the bridge is enabled) the same agent answers DMs. Approval prompts arrive as inline-keyboard buttons.

## Status and inspection

`promus status` prints agent state, wallet position, and a config snapshot.

`promus logs [--tail N]` tails the activity log.

`promus inspect [ref]` decodes the iNFT's IntelligentData slots. Default decrypts every slot via the operator wallet and prints plaintext; flags scope the output, and a raw mode shows slot digests and sizes without the decryption key (works for foreign iNFTs).

## Funds

`promus transfer` sends value from the agent EOA. `promus drain --to <addr>` sweeps the agent EOA's native balance to a target (defaulting to the operator), reserving gas for the sweep transaction.

## Sync

`promus sync` forces a memory and activity-log flush to IPFS and anchors the changed slot digests on chain.

## Gateway

`promus gateway [start|stop|restart|status|logs]` manages the local gateway daemon, which keeps the agent reachable for Telegram and A2A even when the TUI is closed.

## Telegram

`promus telegram [setup|status|remove]` manages the Telegram bridge. Setup pairs a bot token plus allowed user IDs; inbound DMs become brain events.

## Pairing

`promus pairing [list|approve|revoke]` manages paired machines (OTP-based), useful for cross-machine dispatch.

Read [Configuration](/docs/configuration) next.

Source: [`packages/cli/src/commands`](https://github.com/JemIIahh/promus/tree/main/packages/cli/src/commands).
