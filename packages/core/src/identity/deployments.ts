import type { Address } from 'viem'

import type { PromusNetwork } from '../config'

/**
 * Canonical PromusAgentNFT deployment addresses. CREATE2-deployed so both
 * networks share the same address; future deploys under different salts
 * would produce different addresses.
 */
export const ANIMA_AGENT_NFT_ADDRESS: Record<PromusNetwork, Address> = {
  '0g-testnet': '0x9e71d79f06f956d4d2666b5c93dafab721c84721',
  '0g-mainnet': '0x9e71d79f06f956d4d2666b5c93dafab721c84721',
  // PromusAgentNFT, name()="Promus" symbol()="PROMUS", oracle = deployer EOA.
  // Deployed on Arbitrum Sepolia 2026-06; identical CREATE2 address on Robinhood
  // (same salt + initcode + deployer via the Arachnid factory).
  'arbitrum-sepolia': '0x74F838421A2dA38C20Fe9Fd5E87C8FA5c053DDa3',
  'robinhood-testnet': '0x74F838421A2dA38C20Fe9Fd5E87C8FA5c053DDa3',
}

/**
 * Canonical PromusInbox deployment address. Stateless agent-to-agent message
 * emitter (ECIES ciphertext). CREATE2 deterministic via Arachnid's standard
 * factory; no constructor args → identical address on every chain.
 */
export const ANIMA_INBOX_ADDRESS: Record<PromusNetwork, Address> = {
  '0g-testnet': '0xcd92844cc0ec6Be0607B330D4BaCC707339f2589',
  '0g-mainnet': '0xcd92844cc0ec6Be0607B330D4BaCC707339f2589',
  // Deployed on Arbitrum Sepolia + Robinhood Chain testnet 2026-06.
  'arbitrum-sepolia': '0xF937b333978fd8B9A6798b90F5ce8C93e365540b',
  'robinhood-testnet': '0xF937b333978fd8B9A6798b90F5ce8C93e365540b',
}

/**
 * Canonical PromusMarket deployment address. Fixed-price job escrow (agents
 * hire agents). CREATE2 deterministic; same address on every chain.
 * Fee recipient: deployer (immutable).
 */
export const ANIMA_MARKET_ADDRESS: Record<PromusNetwork, Address> = {
  '0g-testnet': '0x3ebD21f5dd67acDeF199fACF28388627212bA2aB',
  '0g-mainnet': '0x3ebD21f5dd67acDeF199fACF28388627212bA2aB',
  // Deployed on Arbitrum Sepolia + Robinhood Chain testnet 2026-06.
  'arbitrum-sepolia': '0x37909ccF38303acc0538be61F4e38b8dB18D0685',
  'robinhood-testnet': '0x37909ccF38303acc0538be61F4e38b8dB18D0685',
}

export const EXPLORER_BASE: Record<PromusNetwork, string> = {
  '0g-mainnet': 'https://chainscan.0g.ai',
  '0g-testnet': 'https://chainscan-galileo.0g.ai',
  'arbitrum-sepolia': 'https://sepolia.arbiscan.io',
  'robinhood-testnet': 'https://explorer.testnet.chain.robinhood.com',
}

export type NetworkName = PromusNetwork

export function explorerTxUrl(network: PromusNetwork, txHash: string): string {
  return `${EXPLORER_BASE[network]}/tx/${txHash}`
}

export function explorerTokenUrl(network: PromusNetwork, contract: string, tokenId: bigint): string {
  return `${EXPLORER_BASE[network]}/token/${contract}/${tokenId}`
}
