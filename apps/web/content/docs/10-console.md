---
slug: console
title: Console
description: The operator console is on the roadmap; the promus CLI is the current interface.
group: Operate
order: 10
kicker: 'DOCS · OPERATE'
voice_word: roadmap
source: 'README.md'
---

# The console is on the roadmap.

A browser-side operator console — connect a wallet, see every iNFT you own, unlock its keystore, read the encrypted memory partition, audit the activity log — is on the roadmap. It is not shipped yet.

For now, the `promus` CLI is the operator interface. It does everything the console will: every decryption happens locally, no key material leaves your machine.

| Want to… | Use |
|---|---|
| Inspect what is anchored on the iNFT | `promus inspect` |
| Read the activity log | `promus logs --tail N` |
| Check agent state and wallet | `promus status` |
| Force a memory sync | `promus sync` |
| Recover on a new machine | `promus restore <iNFT-ref>` |

See [CLI](/docs/cli) for the full surface. Track the console alongside the rest of the project at [github.com/JemIIahh/promus](https://github.com/JemIIahh/promus).

Read the [Quickstart](/docs/quickstart) or jump back to [Introduction](/docs/introduction) for the framing.
