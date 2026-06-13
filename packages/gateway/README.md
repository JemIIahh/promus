# promus-harness

Sandbox-resident harness daemon for **promus**. Runs inside the 0G Sandbox TDX TEE, exposes an HTTP control plane (`/chat`, `/events`, `/sync`, `/approval`), bootstraps a keypair, and accepts the agent privkey via Option 3 ECIES handoff from the laptop CLI.

## Install

```bash
bun add promus-harness
```

Requires [bun](https://bun.sh) ≥ 1.1.

## Use

You don't run this directly on a laptop. It's bootstrapped automatically by `promus deploy` (Local→Sandbox migration) and `promus upgrade`. Documented for transparency; consumed by `promus` (the CLI).

See the [root README](https://github.com/JemIIahh/promus#readme) for the full sandbox architecture.
