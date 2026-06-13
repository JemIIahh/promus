import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { type PromusConfig, agentPaths } from '@promus/core'

/**
 * Load the user's `promus.config.ts`.
 *
 * Phase 6.6: canonical location is `~/.promus/config.ts` (returned by
 * `agentPaths.config`). If that file exists, it wins. Otherwise, fall back
 * to walking upward from cwd looking for `promus.config.ts` (legacy v0.5.0
 * pattern, kept so existing dev setups still work without a migration step).
 */
export async function findAndLoadConfig(
  startDir: string = process.cwd(),
): Promise<{ config: PromusConfig; path: string } | null> {
  const canonical = agentPaths.config
  if (existsSync(canonical)) {
    const mod = (await import(canonical)) as { default: PromusConfig }
    if (!mod.default) throw new Error(`promus config at ${canonical} has no default export`)
    return { config: mod.default, path: canonical }
  }

  let dir = resolve(startDir)
  while (true) {
    const candidate = resolve(dir, 'promus.config.ts')
    if (existsSync(candidate)) {
      const mod = (await import(candidate)) as { default: PromusConfig }
      if (!mod.default) throw new Error(`promus.config.ts at ${candidate} has no default export`)
      return { config: mod.default, path: candidate }
    }
    const parent = resolve(dir, '..')
    if (parent === dir) return null
    dir = parent
  }
}
