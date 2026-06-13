# @promus/cli

CLI binary for **Promus**: sovereign AI agents on Arbitrum.

## Install

```bash
# npm
npm i -g @promus/cli

# yarn
yarn global add @promus/cli

# bun
bun add -g @promus/cli
```

Requires [Node.js](https://nodejs.org) ≥ 18 or [Bun](https://bun.sh) ≥ 1.1.

## Quick start

```bash
promus init
```

The wizard mints an iNFT, encrypts your API key, and sets up the agent. Then:

```bash
promus         # chat with your agent
promus status  # health check
promus logs    # follow gateway logs
promus topup   # add ETH to agent wallet
```

See the [root README](https://github.com/JemIIahh/promus#readme) for architecture, concepts, and the full command reference.
