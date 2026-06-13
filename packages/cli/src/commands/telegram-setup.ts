import { cancel, intro, note, outro } from '@clack/prompts'
import { iNFTAgentId } from '@promus/core'
import { type Address, getAddress } from 'viem'
import { findAndLoadConfig } from '../config/load'
import { loadOrPickOperatorSigner } from './init/operator-picker'
import { runTelegramStep } from './init/telegram-step'

/**
 * `promus telegram setup` — standalone entry. Loads the operator wallet, then
 * delegates to `runTelegramStep` (the same helper bundled into `promus init`'s
 * Phase E). Owns its own intro/outro framing.
 */
export async function runTelegramSetup(): Promise<void> {
  intro('promus telegram setup')

  const loaded = await findAndLoadConfig()
  if (!loaded) {
    cancel('No promus.config.ts found. Run `promus init` first.')
    return
  }
  const { config, path: configPath } = loaded
  if (!config.identity.iNFT || !config.identity.agent) {
    cancel('Config has no iNFT or agent. Run `promus init` first.')
    return
  }

  const agentAddress = getAddress(config.identity.agent) as Address
  const inftContract = getAddress(config.identity.iNFT.contract) as Address
  const tokenId = BigInt(config.identity.iNFT.tokenId)
  const agentId = iNFTAgentId({ contractAddress: inftContract, tokenId })

  const operator = await loadOrPickOperatorSigner({
    network: config.network,
    hint: config.operator,
  })
  if (!operator) {
    cancel('No operator wallet available; cannot encrypt secrets.')
    return
  }

  let result: Awaited<ReturnType<typeof runTelegramStep>>
  try {
    result = await runTelegramStep({
      signer: operator,
      agentId,
      agentAddress,
      configPath,
      config,
      network: config.network,
    })
  } finally {
    await operator.close?.()
  }

  if (!result.configured) {
    cancel(result.cancelled ? 'Aborted.' : 'Setup failed.')
    return
  }

  const isSandbox = config.deployTarget === 'sandbox' && config.sandbox?.endpoint
  if (isSandbox) {
    note(
      'Sandbox-mode agent: secrets are stored locally now, but the harness inside\nthe Daytona container needs them too. Run `promus upgrade` to ship them across\nthe handoff envelope.',
      'sandbox handoff pending',
    )
  } else {
    note(
      `Open https://t.me/${result.botUsername} in Telegram and send any message.\nThen run \`promus\` (or \`promus gateway start\`) to bring the agent online.`,
      'next step',
    )
  }

  outro(`telegram setup complete (@${result.botUsername}, mode: ${result.modeUsed})`)
}
