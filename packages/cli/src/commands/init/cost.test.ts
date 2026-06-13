import { describe, expect, it } from 'bun:test'
import { parseEther } from 'viem'
import {
  SANDBOX_BURN_RATE_OG_PER_HOUR,
  SANDBOX_DEFAULT_INITIAL_DEPOSIT_OG,
  estimateCosts,
  renderCostSummary,
} from './cost'

describe('estimateCosts (0G stack)', () => {
  // NOTE: the 0G network path still exists in promus-core but the display
  // strings have been migrated to ETH / Arbitrum branding.
  it('local target: zero sandbox fields', () => {
    const c = estimateCosts({
      ledgerSizeOg: 3,
      withSubname: true,
      deployTarget: 'local',
      network: '0g-mainnet',
    })
    expect(c.sandboxInitialDepositTestnet).toBe(0n)
    expect(c.sandboxBurnRatePerHourTestnet).toBe(0n)
    expect(c.deployTarget).toBe('local')
    expect(c.totalOperator).toBe(parseEther('3.115'))
    expect(c.currency).toBe('0G')
    expect(c.lean).toBe(false)
  })

  it('sandbox target: populates testnet fields', () => {
    const c = estimateCosts({
      ledgerSizeOg: 3,
      withSubname: true,
      deployTarget: 'sandbox',
      network: '0g-mainnet',
    })
    expect(c.sandboxInitialDepositTestnet).toBe(
      parseEther(String(SANDBOX_DEFAULT_INITIAL_DEPOSIT_OG)),
    )
    expect(c.sandboxBurnRatePerHourTestnet).toBe(parseEther(String(SANDBOX_BURN_RATE_OG_PER_HOUR)))
    expect(c.deployTarget).toBe('sandbox')
    // mainnet totalOperator UNCHANGED by deploy target (testnet is a separate pool)
    expect(c.totalOperator).toBe(parseEther('3.115'))
  })

  it('burn rate equals topup.ts canonical 0.09 0G/hour', () => {
    expect(SANDBOX_BURN_RATE_OG_PER_HOUR).toBe(0.09)
    const c = estimateCosts({
      ledgerSizeOg: 3,
      withSubname: false,
      deployTarget: 'sandbox',
      network: '0g-mainnet',
    })
    expect(c.sandboxBurnRatePerHourTestnet).toBe(parseEther('0.09'))
  })
})

describe('estimateCosts (lean stack: Arbitrum/Claude/IPFS)', () => {
  it('only real L2 gas: mint + small ETH agent float, no ledger or subname', () => {
    const c = estimateCosts({
      ledgerSizeOg: 0,
      withSubname: false,
      deployTarget: 'local',
      network: 'arbitrum-sepolia',
    })
    expect(c.lean).toBe(true)
    expect(c.currency).toBe('ETH')
    expect(c.agentFloat).toBeGreaterThan(0n) // small ETH float for the agent EOA
    expect(c.computeLedgerDeposit).toBe(0n)
    expect(c.subnameAndRecords).toBe(0n)
    expect(c.storageUploadGas).toBe(0n) // anchor paid from the agent float
    expect(c.sandboxInitialDepositTestnet).toBe(0n)
    // mint + agent float only — well under a faucet-funded testnet wallet
    expect(c.totalOperator).toBe(c.mintAndApproveGas + c.agentFloat)
    expect(c.totalOperator).toBeLessThan(parseEther('0.002'))
  })

  it('Robinhood Orbit L2 is also lean / ETH', () => {
    const c = estimateCosts({
      ledgerSizeOg: 10,
      withSubname: true,
      deployTarget: 'local',
      network: 'robinhood-testnet',
    })
    expect(c.lean).toBe(true)
    expect(c.currency).toBe('ETH')
    // ledger size + subname requests are ignored on the lean stack
    expect(c.computeLedgerDeposit).toBe(0n)
    expect(c.subnameAndRecords).toBe(0n)
  })
})

describe('renderCostSummary (0G stack)', () => {
  it('local target: omits sandbox section', () => {
    const c = estimateCosts({
      ledgerSizeOg: 3,
      withSubname: true,
      deployTarget: 'local',
      network: '0g-mainnet',
    })
    const out = renderCostSummary(c)
    expect(out).toContain('operator spend (Arbitrum mainnet)')
    expect(out).toContain('mint + setApprovalForAll')
    expect(out).toContain('compute ledger deposit')
    expect(out).not.toContain('sandbox spend')
    expect(out).not.toContain('Galileo testnet')
    expect(out).not.toContain('faucet')
  })

  it('sandbox target: includes Galileo testnet section with runway + faucet', () => {
    const c = estimateCosts({
      ledgerSizeOg: 3,
      withSubname: true,
      deployTarget: 'sandbox',
      network: '0g-mainnet',
    })
    const out = renderCostSummary(c)
    expect(out).toContain('sandbox spend (Arbitrum testnet, free via faucet):')
    expect(out).toContain('initial provider deposit')
    expect(out).toContain('runtime burn')
    expect(out).toContain('1 ETH')
    expect(out).toContain('0.09 ETH/h')
    expect(out).toContain('auto-topup')
    expect(out).toContain('runway')
  })

  it('sandbox target: runway expressed in hours for ~1 0G default', () => {
    const c = estimateCosts({
      ledgerSizeOg: 3,
      withSubname: false,
      deployTarget: 'sandbox',
      network: '0g-mainnet',
    })
    const out = renderCostSummary(c)
    // 1 ETH / 0.09 ETH/h = 11.11h
    expect(out).toMatch(/~11\.[0-9]h runway/)
  })

  it('still shows USD $0.00 for testnet line', () => {
    const c = estimateCosts({
      ledgerSizeOg: 3,
      withSubname: false,
      deployTarget: 'sandbox',
      network: '0g-mainnet',
    })
    const out = renderCostSummary(c)
    // Testnet ETH is free — USD col should read ($0.00)
    expect(out).toMatch(/initial provider deposit\s+1 ETH\s+\(\$0\.00\)/)
    expect(out).not.toMatch(/initial provider deposit\s+1 ETH\s+\(\$0\.50\)/)
  })
})

describe('renderCostSummary (lean stack)', () => {
  it('ETH gas only: no economy lines', () => {
    const c = estimateCosts({
      ledgerSizeOg: 0,
      withSubname: false,
      deployTarget: 'local',
      network: 'arbitrum-sepolia',
    })
    const out = renderCostSummary(c)
    expect(out).toContain('operator spend (ETH L2 gas)')
    expect(out).toContain('mint + setApprovalForAll')
    expect(out).toContain('agent gas float')
    expect(out).toContain('total operator spend')
    expect(out).not.toContain('0G')
    expect(out).not.toContain('agent infra float')
    expect(out).not.toContain('compute ledger deposit')
    expect(out).not.toContain('sandbox spend')
  })
})
