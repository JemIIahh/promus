import { cancel, intro, outro } from '@clack/prompts'
import { defineConfig } from 'promus-core'
import { findAndLoadConfig } from '../config/load'
import { writeConfigTs } from '../config/render'
import { pickBrainModel } from './init/model-picker'

/**
 * `promus model` — re-pick the brain provider/model. Updates the persisted
 * config so subsequent `promus` (chat) sessions use the new choice.
 *
 * The TUI also exposes `/model` as a slash command for in-session switching;
 * see `chat.tsx`.
 */
export async function runModel(): Promise<void> {
  intro('promus model')

  const loaded = await findAndLoadConfig()
  if (!loaded) {
    cancel('No promus.config.ts found. Run `promus init` first.')
    return
  }
  const { config } = loaded

  const pick = await pickBrainModel({ network: config.network })
  if (!pick) {
    cancel('No model picked.')
    return
  }

  const updated = defineConfig({
    ...config,
    brain: { provider: pick.provider, model: pick.model },
  })
  await writeConfigTs(loaded.path, updated, {
    header: '// Updated by `promus model`. Edit freely; type-safe.',
  })

  outro(
    [
      '',
      `  brain    ${pick.model ?? '?'}`,
      `  provider ${pick.provider}`,
      `  config   ${loaded.path}`,
      '',
      'Next chat session will use the new brain.',
    ].join('\n'),
  )
}
