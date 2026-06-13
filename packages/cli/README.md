# promus

CLI binary for **promus**: the first fully on-chain sovereign agent harness on 0G.

## Install

```bash
bun add -g promus
promus init
```

Requires [bun](https://bun.sh) ≥ 1.1.

## Commands

`promus init` boots the wizard (mints an iNFT, opens a 0G Compute ledger, generates the agent EOA). After that: `promus` for chat, `promus status`, `promus logs`, `promus topup`, `promus ledger`, `promus drain`, `promus sync`, `promus inspect`, `promus deploy`, `promus upgrade`, `promus help` for the full list.

See the [root README](https://github.com/JemIIahh/promus#readme) for architecture, concepts, and the full command reference.
