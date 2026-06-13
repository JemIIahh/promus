// Block explorer links for the Promus contracts. Primary network is Arbitrum
// Sepolia (chainId 421614); the same CREATE2 addresses are also live on
// Robinhood Chain testnet (46630). Addresses mirror
// packages/core/src/identity/deployments.ts.
const EXPLORER_BASE = 'https://sepolia.arbiscan.io'

export const CONTRACTS = {
  PromusAgentNFT: '0x74F838421A2dA38C20Fe9Fd5E87C8FA5c053DDa3',
  PromusInbox: '0xF937b333978fd8B9A6798b90F5ce8C93e365540b',
  PromusMarket: '0x37909ccF38303acc0538be61F4e38b8dB18D0685',
} as const

export function txUrl(hash: string) {
  return `${EXPLORER_BASE}/tx/${hash}`
}

export function addressUrl(address: string) {
  return `${EXPLORER_BASE}/address/${address}`
}

export function tokenUrl(contract: string, tokenId: string | number) {
  return `${EXPLORER_BASE}/token/${contract}?a=${tokenId}`
}

export function truncate(value: string, head = 6, tail = 4): string {
  if (!value) return ''
  if (value.length <= head + tail + 2) return value
  return `${value.slice(0, head)}…${value.slice(-tail)}`
}
