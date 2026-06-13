# promus-core

Always-on infrastructure for **promus**: runtime, brain (0G Compute), identity (iNFT), memory (0G Storage), wallet, tool registry, event queue, plugin context.

## Install

```bash
bun add promus-core
```

Requires [bun](https://bun.sh) ≥ 1.1.

## Use

You don't usually depend on `promus-core` directly. Install [`promus`](https://www.npmjs.com/package/promus) (the CLI) which pulls everything in. This package exists for plugin authors and library consumers who want to embed the runtime.

See the [root README](https://github.com/JemIIahh/promus#readme) for architecture and the full surface.
