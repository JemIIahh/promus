/**
 * `anima gateway run` — foreground daemon (blocks; Ctrl+C to stop).
 *
 * Spawns `anima-gateway-local` (the bin in promus-gateway) with
 * inherit stdio so the user sees logs live. Reads operator-session for the
 * cached AES keys; fails loud if no session exists ("run anima gateway start
 * first").
 */

import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { resolveLocalBin } from '../util/gateway-spawn'

export interface GatewayRunOpts {
  agentId?: string
}

export async function runGatewayForeground(opts: GatewayRunOpts): Promise<void> {
  const env = { ...process.env }
  if (opts.agentId) env.PROMUS_AGENT_ID = opts.agentId
  // Default PROMUS_CONFIG to ~/.anima/config.ts if not already set.
  if (!env.PROMUS_CONFIG) {
    env.PROMUS_CONFIG = join(env.HOME ?? '', '.anima', 'config.ts')
  }

  const localBin = resolveLocalBin()
  // AWAIT the child for the lifetime of the foreground daemon. Returning early
  // lets the CLI's top-level `main().then(() => process.exit(0))` fire and kill
  // the daemon the instant it spawns (the "silent immediate exit" bug). Use the
  // current bun binary (process.execPath) instead of `bun` on PATH, which the
  // user's shell may not include (~/.bun/bin).
  await new Promise<void>(resolve => {
    const proc = spawn(process.execPath, [localBin], {
      env,
      stdio: 'inherit',
    })
    const forwardSignal = (sig: NodeJS.Signals): void => {
      if (!proc.killed) proc.kill(sig)
    }
    process.on('SIGINT', () => forwardSignal('SIGINT'))
    process.on('SIGTERM', () => forwardSignal('SIGTERM'))
    proc.on('exit', code => {
      process.exitCode = code ?? 0
      resolve()
    })
    proc.on('error', err => {
      console.error(`promus gateway run: spawn failed — ${err.message}`)
      process.exitCode = 1
      resolve()
    })
  })
}
