# promus

CLI binary for **anima**: the first fully on-chain sovereign agent harness on 0G.

## Install

```bash
bun add -g promus
anima init
```

Requires [bun](https://bun.sh) ≥ 1.1.

## Commands

`anima init` boots the wizard (mints an iNFT, opens a 0G Compute ledger, generates the agent EOA). After that: `anima` for chat, `anima status`, `anima logs`, `anima topup`, `anima ledger`, `anima drain`, `anima sync`, `anima inspect`, `anima deploy`, `anima upgrade`, `anima help` for the full list.

See the [root README](https://github.com/JemIIahh/promus#readme) for architecture, concepts, and the full command reference.
