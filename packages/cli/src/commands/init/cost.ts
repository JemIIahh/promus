import {
  type PromusNetwork,
  NETWORK_CURRENCY,
  SANDBOX_BURN_RATE_OG_PER_HOUR,
  SANDBOX_DEFAULT_INITIAL_DEPOSIT_OG,
  isOgNetwork,
} from '@promus/core'
import { formatEther } from 'viem'

export { SANDBOX_BURN_RATE_OG_PER_HOUR, SANDBOX_DEFAULT_INITIAL_DEPOSIT_OG }

/** ETH spot price used for USD estimates. Not authoritative, just a hint. */
const ETH_USD = 3500

export type DeployTarget = 'local' | 'sandbox'

export interface CostBreakdown {
  mintAndApproveGas: bigint
  agentFloat: bigint
  computeLedgerDeposit: bigint
  storageUploadGas: bigint
  subnameAndRecords: bigint
  totalOperator: bigint
  /** Galileo testnet — present only when deployTarget === 'sandbox'. */
  sandboxInitialDepositTestnet: bigint
  /** Galileo testnet burn rate per hour, in wei. */
  sandboxBurnRatePerHourTestnet: bigint
  deployTarget: DeployTarget
  /** Native gas-token symbol for the chosen network ('ETH'). */
  currency: string
  /** Lean stack = Claude brain + IPFS memory + local runtime. */
  lean: boolean
}

export function estimateCosts(opts: {
  ledgerSizeOg: number
  withSubname: boolean
  deployTarget: DeployTarget
  network: PromusNetwork
}): CostBreakdown {
  const currency = NETWORK_CURRENCY[opts.network]
  const lean = !isOgNetwork(opts.network)

  if (lean) {
    // Arbitrum-family: only real L2 gas, in ETH. Memory is IPFS (off-chain) and
    // the brain is Claude (off-chain API key), so there is no compute ledger or
    // storage cost, and no subname. The operator pays the mint, then seeds a
    // small ETH float to the agent EOA — the agent spends it on its own
    // keystore-CID anchor and the per-turn memory-sync anchors. Both numbers
    // are generous L2 buffers that stay well under a faucet-funded testnet wallet.
    const mintAndApproveGas = 200_000_000_000_000n // ~0.0002 ETH (mint + setApprovalForAll; ~6x the real L2 cost)
    const agentFloat = 300_000_000_000_000n // ~0.0003 ETH — agent EOA gas for anchors + ~60 memory syncs
    const totalOperator = mintAndApproveGas + agentFloat
    return {
      mintAndApproveGas,
      agentFloat,
      computeLedgerDeposit: 0n,
      storageUploadGas: 0n,
      subnameAndRecords: 0n,
      totalOperator,
      sandboxInitialDepositTestnet: 0n,
      sandboxBurnRatePerHourTestnet: 0n,
      deployTarget: opts.deployTarget,
      currency,
      lean,
    }
  }

  const mintAndApproveGas = 10_000_000_000_000_000n // ~0.01 ETH (mint + setApprovalForAll bundle)
  const agentFloat = 100_000_000_000_000_000n // 0.1 ETH — infra float for the agent
  const computeLedgerDeposit = BigInt(Math.round(opts.ledgerSizeOg * 1e18))
  const storageUploadGas = 5_000_000_000_000_000n // ~0.005 ETH (storage anchor tx)
  const subnameAndRecords = opts.withSubname
    ? 30_000_000_000_000_000n // ~0.03 ETH (claim + 2 text records, paid from agent float)
    : 0n
  const totalOperator = mintAndApproveGas + agentFloat + computeLedgerDeposit + storageUploadGas
  const sandboxInitialDepositTestnet =
    opts.deployTarget === 'sandbox'
      ? BigInt(Math.round(SANDBOX_DEFAULT_INITIAL_DEPOSIT_OG * 1e18))
      : 0n
  const sandboxBurnRatePerHourTestnet =
    opts.deployTarget === 'sandbox' ? BigInt(Math.round(SANDBOX_BURN_RATE_OG_PER_HOUR * 1e18)) : 0n
  return {
    mintAndApproveGas,
    agentFloat,
    computeLedgerDeposit,
    storageUploadGas,
    subnameAndRecords,
    totalOperator,
    sandboxInitialDepositTestnet,
    sandboxBurnRatePerHourTestnet,
    deployTarget: opts.deployTarget,
    currency,
    lean,
  }
}

export function formatUsd(valueWei: bigint): string {
  const eth = Number(formatEther(valueWei))
  return `$${(eth * ETH_USD).toFixed(2)}`
}

function formatRunway(depositWei: bigint, burnPerHourWei: bigint): string {
  if (burnPerHourWei === 0n) return ''
  const hours = Number(depositWei) / Number(burnPerHourWei)
  if (hours < 1) return `${Math.round(hours * 60)} min runway`
  if (hours < 48) return `~${hours.toFixed(1)}h runway`
  const days = hours / 24
  return `~${days.toFixed(1)}d runway`
}

export function renderCostSummary(c: CostBreakdown): string {
  // On the lean stack the gas token is testnet ETH (no market price) — show $0.00.
  const usd = (wei: bigint): string => (c.lean ? '$0.00' : formatUsd(wei))
  const line = (label: string, wei: bigint): string =>
    `    ${label.padEnd(32)}${formatEther(wei).padStart(8)} ${c.currency}  (${usd(wei)})`

  if (c.lean) {
    // Claude + IPFS + local: operator pays the mint, then seeds the agent EOA
    // float that covers the keystore-CID anchor + per-turn memory-sync anchors.
    return [
      `  operator spend (${c.currency} L2 gas):`,
      line('mint + setApprovalForAll', c.mintAndApproveGas),
      line('agent gas float', c.agentFloat),
      `    ${'─'.repeat(32)}${'─'.repeat(18)}`,
      line('total operator spend', c.totalOperator),
    ].join('\n')
  }

  const lines = [
    '  operator spend (Arbitrum mainnet):',
    line('mint + setApprovalForAll', c.mintAndApproveGas),
    line('storage upload (keystore)', c.storageUploadGas),
    line('agent infra float', c.agentFloat),
    line('compute ledger deposit', c.computeLedgerDeposit),
    `    ${'─'.repeat(32)}${'─'.repeat(18)}`,
    line('total operator spend', c.totalOperator),
    '',
    '  agent spend (from the float):',
    line('subname + text records', c.subnameAndRecords),
  ]
  if (c.deployTarget === 'sandbox') {
    const runway = formatRunway(c.sandboxInitialDepositTestnet, c.sandboxBurnRatePerHourTestnet)
    lines.push(
      '',
      '  sandbox spend (Arbitrum testnet, free via faucet):',
      `    ${'initial provider deposit'.padEnd(32)}${formatEther(c.sandboxInitialDepositTestnet).padStart(8)} ETH   ($0.00)`,
      `    ${'runtime burn'.padEnd(32)}${formatEther(c.sandboxBurnRatePerHourTestnet).padStart(8)} ETH/h (${runway})`,
      '    fund via       faucet → paste operator address',
      '    auto-topup     agent EOA refills sandbox billing from compute ledger',
    )
  }
  return lines.join('\n')
}
