import { describe, expect, it } from 'bun:test'
import { LedgerInsufficientError, parseLedgerInsufficientError } from './compute'

const PROVIDER = '0x992e6396157Dc4f22E74F2231235D7DE62696db5'

describe('parseLedgerInsufficientError', () => {
  it('parses the live provider HTTP 400 message format', () => {
    const body =
      'Provider proxy: handle proxied service, validate request: insufficient balance: ' +
      'your locked balance is 1.443572 ETH, but the required minimum is 1.449911 ETH ' +
      '(breakdown: minimum reserve 1.000000 ETH + unsettled fees 0.449911 ETH + current request fee 0.000000 ETH). Please add more'
    const err = parseLedgerInsufficientError(body, PROVIDER)
    expect(err).toBeInstanceOf(LedgerInsufficientError)
    expect(err?.availableOg).toBe('1.443572')
    expect(err?.requiredOg).toBe('1.449911')
    expect(err?.shortfallOg).toBe('0.006339')
    expect(err?.providerAddress).toBe(PROVIDER)
    expect(err?.message).toContain('topup --compute')
  })

  it('returns null on unrelated error bodies', () => {
    expect(parseLedgerInsufficientError('Internal Server Error', PROVIDER)).toBeNull()
    expect(parseLedgerInsufficientError('', PROVIDER)).toBeNull()
    expect(parseLedgerInsufficientError('insufficient balance but malformed', PROVIDER)).toBeNull()
  })

  it('handles whitespace variants in the regex', () => {
    const body =
      'insufficient balance: your locked balance is 1.0 ETH, but the required minimum is 2.0 ETH'
    const err = parseLedgerInsufficientError(body, PROVIDER)
    expect(err).not.toBeNull()
    expect(err?.shortfallOg).toBe('1.000000')
  })

  it('LedgerInsufficientError is thrown shape', () => {
    const err = new LedgerInsufficientError({
      availableOg: '1.0',
      requiredOg: '2.0',
      shortfallOg: '1.0',
      providerAddress: PROVIDER,
    })
    expect(err.name).toBe('LedgerInsufficientError')
    expect(err.providerAddress).toBe(PROVIDER)
  })
})
