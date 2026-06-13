import { existsSync } from 'node:fs'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  note,
  outro,
  password,
  select,
  spinner,
  text,
} from '@clack/prompts'
import {
  type PromusNetwork,
  NETWORK_CHAIN_ID,
  NETWORK_CURRENCY,
  NETWORK_RPC,
  OPERATOR_BLOB_SCOPES,
  type OperatorSessionKeys,
  agentPaths,
  buildOperatorSession,
  defineConfig,
  explorerTokenUrl,
  explorerTxUrl,
  generateAgentWallet,
  getGasPriceWithFloor,
  iNFTAgentId,
  mintAgent,
  placeholderAgentId,
  precomputeAllScopes,
  saveKeystoreLocally,
  uploadAndAnchorKeystore,
  waitForReceiptResilient,
  writeOperatorSession,
} from '@promus/core'
import { type Address, type Hex, formatEther, hexToBytes, parseEther } from 'viem'
import { writeConfigTs } from '../config/render'
import { withSilencedConsole } from '../util/silence-console'
import { saveBrainSecrets } from '../util/brain-secrets'
import { loadTelegramHandoffSecrets } from '../util/telegram-secrets'
import { estimateCosts, renderCostSummary } from './init/cost'
import { fundingGate } from './init/funding-gate'
import { pickOperatorSigner } from './init/operator-picker'
import { initialWizardState, updateWizardState, writeWizardState } from './init/wizard-state'

export async function runInit(opts?: { cwd?: string; resume?: boolean }): Promise<void> {
  const configPath = agentPaths.config

  intro('promus init')

  if (existsSync(configPath) && !opts?.resume) {
    const choice = (await select({
      message: `${configPath} exists`,
      options: [
        { value: 'overwrite', label: 'Start fresh (overwrite)' },
        { value: 'cancel', label: 'Cancel' },
      ],
      initialValue: 'cancel',
    })) as 'overwrite' | 'cancel' | symbol
    if (isCancel(choice) || choice === 'cancel') {
      cancel('Aborted.')
      return
    }
  }

  // ─── Phase A: local prompts (no chain, no wallet) ───────────────────────

  const network = (await select({
    message: 'Which network?',
    options: [
      { value: 'arbitrum-sepolia' as PromusNetwork, label: 'Arbitrum Sepolia (421614)' },
      { value: 'robinhood-testnet' as PromusNetwork, label: 'Robinhood Chain testnet (46630)' },
    ],
    initialValue: 'arbitrum-sepolia' as PromusNetwork,
  })) as PromusNetwork
  if (isCancel(network)) {
    cancel('Aborted.')
    return
  }

  // Deploy target is always local on the Arbitrum path.
  const deployTarget = 'local' as const
  const requestedSubname = ''

  // ─── Brain provider + model picker ──────────────────────────────────────
  const brainProvider = (await select({
    message: 'Which AI provider?',
    options: [
      { value: 'anthropic' as const, label: 'Anthropic (Claude)' },
      { value: 'openai' as const, label: 'OpenAI (GPT)' },
      { value: 'google' as const, label: 'Google (Gemini)' },
    ],
    initialValue: 'anthropic' as const,
  })) as 'anthropic' | 'openai' | 'google' | symbol
  if (isCancel(brainProvider)) {
    cancel('Aborted.')
    return
  }

  const modelPick = { provider: brainProvider, model: null as string | null }

  // ─── Brain API key (encrypted at rest) ──────────────────────────────────
  const providerLabel = brainProvider === 'anthropic' ? 'Anthropic' : brainProvider === 'openai' ? 'OpenAI' : 'Google'
  const apiKeyPrompt = (await password({
    message: `${providerLabel} API key (stored encrypted, never in .env)`,
    mask: '*',
  })) as string | symbol
  if (isCancel(apiKeyPrompt) || !apiKeyPrompt) {
    cancel('Aborted.')
    return
  }

  // ─── Storage backend picker ─────────────────────────────────────────────
  const storageBackend = (await select({
    message: 'Storage backend?',
    options: [
      { value: 'ipfs' as const, label: 'IPFS (Kubo local node)' },
    ],
    initialValue: 'ipfs' as const,
  })) as 'ipfs' | symbol
  if (isCancel(storageBackend)) {
    cancel('Aborted.')
    return
  }

  let ipfsApiUrl = 'http://127.0.0.1:5001'
  let ipfsGateway = 'http://127.0.0.1:8080/ipfs'
  if (storageBackend === 'ipfs') {
    const customUrl = (await text({
      message: 'IPFS API URL',
      initialValue: 'http://127.0.0.1:5001',
    })) as string | symbol
    if (isCancel(customUrl)) { cancel('Aborted.'); return }
    ipfsApiUrl = customUrl || 'http://127.0.0.1:5001'

    const customGw = (await text({
      message: 'IPFS gateway URL (trailing /ipfs)',
      initialValue: 'http://127.0.0.1:8080/ipfs',
    })) as string | symbol
    if (isCancel(customGw)) { cancel('Aborted.'); return }
    ipfsGateway = customGw || 'http://127.0.0.1:8080/ipfs'
  }

  // ─── Phase B: wallet gate ────────────────────────────────────────────────

  const picked = await pickOperatorSigner({ network })
  if (!picked) return
  const { signer: operator, hint: operatorHint } = picked

  const sConnect = spinner()
  sConnect.start(`Connecting via ${operator.source}`)
  let operatorAddress: Address
  try {
    operatorAddress = await operator.address()
    sConnect.stop(`operator: ${operatorAddress}`)
  } catch (e) {
    sConnect.stop(`connection failed: ${(e as Error).message.slice(0, 140)}`)
    await operator.close?.()
    return
  }

  const costs = estimateCosts({
    ledgerSizeOg: 0,
    withSubname: false,
    deployTarget: 'local',
    network,
  })
  note(renderCostSummary(costs), `cost summary (${costs.currency} L2 gas)`)

  const publicClient = await operator.publicClient(network)
  const operatorBalance = await publicClient.getBalance({ address: operatorAddress })

  if (operatorBalance < costs.totalOperator) {
    const need = costs.totalOperator - operatorBalance
    note(
      `Operator balance ${formatEther(operatorBalance)} ${costs.currency}, need ${formatEther(need)} ${costs.currency} more.`,
      'insufficient funds',
    )
    const gate = await fundingGate({
      publicClient,
      operatorAddress,
      requiredOg: costs.totalOperator,
      currency: costs.currency,
    })
    if (gate.kind === 'cancel') {
      await operator.close?.()
      return
    }
  }

  const proceed = await confirm({ message: 'Proceed?', initialValue: true })
  if (isCancel(proceed) || !proceed) {
    cancel('Aborted.')
    await operator.close?.()
    return
  }

  // ─── Phase C: execute with Pattern B state tracking ─────────────────────

  const agent = generateAgentWallet()
  const provisionalAgentId = placeholderAgentId(agent.address)
  const provisional = agentPaths.agent(provisionalAgentId)
  await mkdir(provisional.dir, { recursive: true })

  await writeWizardState(provisional.dir, {
    ...initialWizardState(agent.address, network),
  })

  let mintedTokenId: bigint | null = null
  let contractAddress: Address | null = null

  const sMint = spinner()
  sMint.start(`Minting iNFT on ${network} (keystore slot left as bootstrap until upload)`)
  try {
    const { result, contractAddress: c } = await withSilencedConsole(() =>
      mintAgent({
        network,
        operator,
        agentAddress: agent.address as Address,
      }),
    )
    mintedTokenId = result.tokenId
    contractAddress = c
    await updateWizardState(provisional.dir, draft => {
      draft.steps.mintedTokenId = result.tokenId.toString()
      draft.steps.mintedContract = c
      draft.steps.mintTx = result.txHash
    })
    sMint.stop(
      `iNFT #${result.tokenId.toString()} minted to ${operatorAddress} → ${explorerTxUrl(network, result.txHash)}`,
    )
  } catch (e) {
    sMint.stop(`mint failed: ${(e as Error).message}`)
    await updateWizardState(provisional.dir, draft => {
      draft.lastError = `mint failed: ${(e as Error).message}`
    })
    await operator.close?.()
    return
  }

  const finalAgentId = iNFTAgentId({ contractAddress: contractAddress!, tokenId: mintedTokenId! })
  const targetDir = agentPaths.agent(finalAgentId).dir
  if (provisional.dir !== targetDir) {
    try {
      await rename(provisional.dir, targetDir)
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e
    }
  }
  const paths = agentPaths.agent(finalAgentId)

  // v0.23.1: derive BOTH operator-scope keys (keystore + profile) in parallel
  // up front, then reuse them everywhere. This is the single "two signatures
  // back to back" moment in the wizard: keystore scope (for the encrypted
  // privkey blob) + profile scope (for the operator-private user-partition
  // memory slot). Folding profile derivation into init removes the v0.23.0
  // need for `promus profile init` as a follow-up command.
  const sKeys = spinner()
  sKeys.start('Deriving operator scope keys (may prompt twice: keystore + profile)')
  let operatorKeys: OperatorSessionKeys
  let keystoreKeyBuf: Buffer
  let profileScopeKeyHex: `0x${string}` | undefined
  let brainScopeKeyHex: `0x${string}` | undefined
  try {
    operatorKeys = await precomputeAllScopes(operator, agent.address as Address, [
      OPERATOR_BLOB_SCOPES.PROFILE,
      OPERATOR_BLOB_SCOPES.BRAIN,
    ])
    keystoreKeyBuf = Buffer.from(hexToBytes(operatorKeys.keystore))
    const profileHex = operatorKeys[OPERATOR_BLOB_SCOPES.PROFILE]
    profileScopeKeyHex = profileHex as `0x${string}` | undefined
    brainScopeKeyHex = operatorKeys[OPERATOR_BLOB_SCOPES.BRAIN] as `0x${string}` | undefined
    sKeys.stop('scope keys derived')
  } catch (e) {
    sKeys.stop(`scope key derive failed: ${(e as Error).message.slice(0, 160)}`)
    cancel('Aborted (operator signature required for keystore + profile scopes).')
    await operator.close?.()
    return
  }

  // Pass the already-derived keystoreKey so saveKeystoreLocally skips
  // signing again. Save BEFORE funding the agent EOA per
  // `feedback-init-must-save-keystore-before-funding.md`.
  const sLocal = spinner()
  sLocal.start('Encrypting agent keystore to operator wallet (local insurance)')
  let encryptedBytes: Uint8Array
  try {
    const saved = await saveKeystoreLocally({
      agentAddress: agent.address as Address,
      agentPrivkey: agent.privkeyHex as Hex,
      cachePath: paths.keystore,
      precomputedKey: keystoreKeyBuf,
    })
    encryptedBytes = saved.bytes
    await updateWizardState(paths.dir, draft => {
      draft.steps.keystoreSaved = true
    })
    sLocal.stop(`keystore saved locally at ${paths.keystore}`)
  } catch (e) {
    sLocal.stop(`local keystore save failed: ${(e as Error).message.slice(0, 120)}`)
    cancel('Aborted before funding (keystore encryption failed).')
    await operator.close?.()
    return
  }

  // ─── Save encrypted brain secrets ────────────────────────────────────────
  const sBrain = spinner()
  sBrain.start('Encrypting brain secrets (API key + storage config)')
  try {
    const brainKeyBuf = brainScopeKeyHex
      ? Buffer.from(hexToBytes(brainScopeKeyHex))
      : undefined
    await saveBrainSecrets({
      signer: operator,
      agentAddress: agent.address as Address,
      agentId: finalAgentId,
      plaintext: {
        provider: brainProvider,
        apiKey: apiKeyPrompt,
        model: modelPick.model ?? undefined,
        ipfsApiUrl,
        ipfsGateway,
      },
      precomputedKey: brainKeyBuf,
    })
    sBrain.stop('brain secrets encrypted')
  } catch (e) {
    sBrain.stop(`brain secrets save failed: ${(e as Error).message.slice(0, 120)}`)
    // Non-fatal: user can re-run init or set .env as fallback
  }

  const sFund = spinner()
  const fundingAmount = costs.agentFloat
  sFund.start(`Funding agent ${agent.address} with ${formatEther(fundingAmount)} ${costs.currency}`)
  try {
    const opWc = await operator.walletClient(network)
    const opAccount = opWc.account
    if (!opAccount) throw new Error('walletClient is missing default account')
    const fundGasPrice = await getGasPriceWithFloor(publicClient)
    const fundTx = await withSilencedConsole(() =>
      opWc.sendTransaction({
        to: agent.address as Address,
        value: fundingAmount,
        chain: operator.chain(network),
        account: opAccount,
        maxFeePerGas: fundGasPrice,
        maxPriorityFeePerGas: fundGasPrice,
      }),
    )
    await waitForReceiptResilient(publicClient, fundTx)
    await updateWizardState(paths.dir, draft => {
      draft.steps.agentFundedTx = fundTx
    })
    sFund.stop(`funded (tx ${fundTx})`)
  } catch (e) {
    sFund.stop(`fund failed: ${(e as Error).message}`)
    await operator.close?.()
    return
  }

  const sPersist = spinner()
  sPersist.start(
    `Uploading keystore to IPFS + anchoring on chain`,
  )
  let keystorePersisted = false
  try {
    const { rootHash, updateTx } = await withSilencedConsole(() =>
      uploadAndAnchorKeystore({
        network,
        agentPrivkey: agent.privkeyHex as Hex,
        tokenId: mintedTokenId!,
        contractAddress: contractAddress!,
        bytes: encryptedBytes,
      }),
    )
    await updateWizardState(paths.dir, draft => {
      draft.steps.keystorePersistedTx = updateTx
      draft.steps.keystoreRootHash = rootHash
    })
    keystorePersisted = true
    sPersist.stop(`keystore anchored (root ${rootHash.slice(0, 12)}…)`)
  } catch (e) {
    sPersist.stop(`keystore upload/anchor failed: ${(e as Error).message.slice(0, 120)}`)
  }

  if (!keystorePersisted) {
    note(
      [
        `iNFT #${mintedTokenId!.toString()} is minted, agent EOA is funded with ${formatEther(fundingAmount)} ${costs.currency},`,
        `and the encrypted keystore is on disk at ${paths.keystore}.`,
        '',
        `The IPFS upload + chain anchor failed, so this machine has`,
        'a working agent but no on-chain recovery path yet. The funds at',
        `${agent.address} are NOT stranded; operator wallet ${operatorAddress}`,
        'can decrypt the local keystore and resume the agent.',
        '',
        'Re-run `promus init --resume` to retry the storage upload and anchor,',
        'or proceed with chat using the local keystore (sync will retry on',
        'every chat turn anyway).',
      ].join('\n'),
      'storage anchor failed (recoverable)',
    )
    cancel('Aborted before writing config (storage anchor pending).')
    await operator.close?.()
    return
  }

  // v0.23.1: cache the operator scope keys to `.operator-session` so:
  //   - First `promus` chat does NOT re-prompt Touch ID (`gateway-start` will
  //     find both keystore + profile scopes already cached and skip
  //     re-derivation).
  //   - First sync after init can encrypt + anchor the PROFILE slot
  //     transparently — operator never needs to run `promus profile init`.
  // requiredScopesForAgent now returns ['keystore', 'anima-profile-v1']
  // because seedStarterMemoryFiles just wrote user/profile.md.
  try {
    const sess = buildOperatorSession({ agent: agent.address as Address, keys: operatorKeys })
    writeOperatorSession(finalAgentId, sess)
  } catch (e) {
    console.warn(`operator-session write skipped: ${(e as Error).message.slice(0, 160)}`)
  }

  // Seed canonical memory starter files.
  await seedStarterMemoryFiles({
    paths,
    network,
    contractAddress: contractAddress!,
    tokenId: mintedTokenId!,
    agentAddress: agent.address as Address,
    operatorAddress,
    brainProvider: modelPick?.provider ?? null,
    brainModel: modelPick?.model ?? null,
  })

  // v0.24.4: Phase E (Telegram bot setup) MUST run before Phase 11 (sandbox
  // provision) so the sandbox handoff envelope can ship `telegram-secrets`
  // and the listener boots active. Previously Phase E ran AFTER provision and
  // the sandbox booted with `listeners.telegram: disabled`, forcing the
  // operator to `promus upgrade --in-place` post-init to re-ship secrets.
  let telegramConfigured: { botUsername: string; mode: string } | null = null
  if (mintedTokenId !== null && contractAddress) {
    const tgChoice = await confirm({
      message: 'Configure a Telegram bot for this agent now? (recommended)',
      initialValue: true,
    })
    if (!isCancel(tgChoice) && tgChoice === true) {
      try {
        const { runTelegramStep } = await import('./init/telegram-step')
        const tgResult = await runTelegramStep({
          signer: operator,
          agentId: finalAgentId,
          agentAddress: agent.address as Address,
          configPath,
          // Synthetic partial cfg — caller writes the final cfg below. Pass
          // skipConfigWrite=true so telegram-step doesn't touch disk.
          config: { plugins: [] } as never,
          network,
          skipConfigWrite: true,
        })
        if (tgResult.configured && tgResult.botUsername && tgResult.modeUsed) {
          telegramConfigured = {
            botUsername: tgResult.botUsername,
            mode: tgResult.modeUsed,
          }
          // v0.24.3: append TELEGRAM key to `.operator-session` so the gateway
          // daemon auto-spawns on first chat without re-prompting Touch ID.
          if (tgResult.telegramScopeKeyHex) {
            try {
              const sess = buildOperatorSession({
                agent: agent.address as Address,
                keys: {
                  ...operatorKeys,
                  [OPERATOR_BLOB_SCOPES.TELEGRAM]: tgResult.telegramScopeKeyHex,
                },
              })
              writeOperatorSession(finalAgentId, sess)
            } catch (e) {
              note(
                `operator-session rewrite skipped: ${(e as Error).message.slice(0, 160)}\nRun \`promus telegram setup\` later to re-derive the TG scope key.`,
                'telegram (non-fatal)',
              )
            }
          }
        }
      } catch (e) {
        note(
          `Telegram step failed: ${(e as Error).message.slice(0, 200)}\nIdentity + iNFT are safe. Re-run \`promus telegram setup\` later.`,
          'non-fatal',
        )
      }
    }
  }

  // Load TG handoff secrets into memory for the sandbox envelope. Skipped if
  // TG wasn't configured this run. The shape is exactly what the harness
  // expects inside the secondary ECIES envelope (botToken + allowedUserIds +
  // optional pairingApproved). Errors are non-fatal: TG is opt-in.
  let telegramHandoff: Awaited<ReturnType<typeof loadTelegramHandoffSecrets>> = undefined
  if (telegramConfigured && mintedTokenId !== null && contractAddress) {
    telegramHandoff = await loadTelegramHandoffSecrets({
      signer: operator,
      agentAddress: agent.address as Address,
      contractAddress,
      tokenId: mintedTokenId,
      onNotice: msg => note(msg, 'telegram handoff (non-fatal)'),
    })
  }

  // ─── Write final config ─────────────────────────────────────────────────

  const cfg = defineConfig({
    identity: {
      iNFT:
        mintedTokenId !== null && contractAddress
          ? {
              contract: contractAddress,
              tokenId: mintedTokenId.toString(),
              network,
            }
          : null,
      operator: operatorAddress,
      agent: agent.address,
    },
    network,
    storage: { network },
    brain: {
      provider: modelPick?.provider ?? null,
      model: modelPick?.model ?? null,
    },
    plugins: telegramConfigured
      ? ['onchain', 'comms', 'system', 'telegram']
      : ['onchain', 'comms', 'system'],
    tools: {},
    imports: { claudeCode: true },
    operator: operatorHint,
    deployTarget: 'local' as const,
  })
  await writeConfigTs(configPath, cfg, {
    header: '// Regenerated by `promus init`. Edit freely; type-safe.',
  })

  await operator.close?.()

  // ─── Phase D: summary ───────────────────────────────────────────────────

  const lines = [
    '',
    `  agent id   ${finalAgentId}`,
    `  agent EOA  ${agent.address}`,
    `  operator   ${operatorAddress}  (source: ${operatorHint.source})`,
    `  network    ${network} (${NETWORK_RPC[network]})`,
    `  chain id   ${NETWORK_CHAIN_ID[network]}`,
    `  config     ${configPath}`,
    `  keystore   on IPFS (cached at ${paths.keystore})`,
  ]
  if (mintedTokenId !== null && contractAddress) {
    lines.push(`  iNFT       #${mintedTokenId.toString()} at ${contractAddress}`)
    lines.push(`             ${explorerTokenUrl(network, contractAddress, mintedTokenId)}`)
  }
  if (modelPick) lines.push(`  brain      ${modelPick.model ?? modelPick.provider}`)
  if (telegramConfigured) {
    lines.push(`  bot        @${telegramConfigured.botUsername} (mode: ${telegramConfigured.mode})`)
  }
  const nextSteps = telegramConfigured
    ? 'Next: `promus` to chat · DM the bot on Telegram · `promus status` for health'
    : 'Next: `promus` to chat · `promus telegram setup` for the bot · `promus status` for health'
  lines.push('', nextSteps)
  outro(lines.join('\n'))
}

interface SeedStarterOpts {
  paths: ReturnType<typeof agentPaths.agent>
  network: PromusNetwork
  contractAddress: Address
  tokenId: bigint
  agentAddress: Address
  operatorAddress: Address
  brainProvider: string | null
  brainModel: string | null
}

/**
 * Seed `MEMORY.md`, `/agent/identity.md`, `/agent/persona.md`, and
 * `/user/profile.md` immediately after mint so the per-turn sync manager
 * has real content for the identity / persona / memory-index slots on the
 * first chat turn.
 */
async function seedStarterMemoryFiles(opts: SeedStarterOpts): Promise<void> {
  const memDir = opts.paths.memoryDir
  const agentMem = `${memDir}/agent`
  const userMem = `${memDir}/user`
  await mkdir(agentMem, { recursive: true })
  await mkdir(userMem, { recursive: true })

  const now = new Date().toISOString().slice(0, 10)
  const identity = `---\nname: identity\ndescription: Auto-written agent identity facts.\ntype: agent-identity\n---\n# Promus identity\n\n- Name: promus\n- iNFT: #${opts.tokenId.toString()} at ${opts.contractAddress} (${opts.network})\n- Agent EOA: ${opts.agentAddress}\n- Operator: ${opts.operatorAddress}\n- Minted: ${now}\n${opts.brainProvider ? `- Brain provider: ${opts.brainProvider}\n` : ''}${opts.brainModel ? `- Brain model: ${opts.brainModel}\n` : ''}`
  const persona = `---\nname: persona\ndescription: Voice + behavior style.\ntype: agent-persona\n---\n# Persona\n\nI am Promus, a sovereign on-chain agent on Arbitrum. I anchor my state on chain every turn, decrypt my keystore via my operator wallet at session start, and reason with my configured AI provider. I am direct, concise, and factual.\n`
  const profile =
    '---\nname: profile\ndescription: User profile (operator-scoped, never anchored on chain).\ntype: user\n---\n# User profile\n\n(empty, fills as we chat)\n'

  await writeFile(join(agentMem, 'identity.md'), identity, 'utf8')
  await writeFile(join(agentMem, 'persona.md'), persona, 'utf8')
  await writeFile(join(userMem, 'profile.md'), profile, 'utf8')

  // Seed an empty MEMORY.md so per-turn sync has something to anchor and the
  // brain's first turn sees a parseable index.
  await writeFile(opts.paths.memoryIndex, '# Promus Memory Index\n\n', 'utf8')
}
