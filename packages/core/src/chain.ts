import {
  http,
  type Chain,
  type Hex,
  type PublicClient,
  type WalletClient,
  createPublicClient,
  createWalletClient,
  defineChain,
} from 'viem'
import { type PrivateKeyAccount, privateKeyToAccount } from 'viem/accounts'
import { type PromusNetwork, NETWORK_CHAIN_ID, NETWORK_RPC, isOgNetwork } from './config'

/**
 * Static fallback floor when `eth_gasPrice` is unreachable. 4 gwei matches the
 * 0G mainnet floor (verified Apr 27 2026). Real callers should prefer
 * `getGasPriceWithFloor` so the value tracks network conditions; this constant
 * is the safety net for the 0G chains.
 *
 * History: was 2.5 gwei; bumped to 4 gwei when txs began rejecting with
 * "gas required exceeds allowance" (Geth's misleading wording for min-fee
 * rejection, not OOG).
 */
export const MIN_GAS_PRICE = 4_000_000_000n

/**
 * Per-chain gas-price floor (wei). 0G needs a 4 gwei floor; the Arbitrum-family
 * L2s run two orders of magnitude cheaper (live Arbitrum Sepolia is ~0.02 gwei),
 * where a 4 gwei floor would over-reserve `gas_limit * maxFee` ~40x and bounce
 * the mint on a lightly-funded wallet. Keyed by chain id so callers don't need
 * to thread a network through.
 */
const MIN_GAS_PRICE_BY_CHAIN: Record<number, bigint> = {
  16661: 4_000_000_000n, // 0G mainnet
  16602: 4_000_000_000n, // 0G testnet (Galileo)
  421614: 100_000_000n, // Arbitrum Sepolia (0.1 gwei)
  46630: 100_000_000n, // Robinhood Orbit L2 (0.1 gwei)
}

/**
 * Read the network's current `eth_gasPrice` and return `max(networkPrice, floor)`,
 * where `floor` is chosen from the client's chain id. Falls back to the floor on
 * RPC failure. Always safe to pass as `maxFeePerGas` / `maxPriorityFeePerGas`.
 */
export async function getGasPriceWithFloor(client: PublicClient): Promise<bigint> {
  let floor = MIN_GAS_PRICE
  try {
    const id = client.chain?.id ?? (await client.getChainId())
    floor = MIN_GAS_PRICE_BY_CHAIN[id] ?? MIN_GAS_PRICE
  } catch {
    // keep the conservative 0G floor
  }
  try {
    const price = await client.getGasPrice()
    return price > floor ? price : floor
  } catch {
    return floor
  }
}

/** Empirical gas budget for `0G Storage Flow.submit()`. Used by preflight balance checks. */
export const STORAGE_SUBMIT_GAS = 250_000n

/**
 * viem `Chain` for an anima network, with correct name + native currency.
 * (Name kept `ogChain` for now; the 0G chains and the Arbitrum-family L2s both
 * route through it.)
 */
export function ogChain(network: PromusNetwork): Chain {
  const meta = isOgNetwork(network)
    ? {
        name: network === '0g-mainnet' ? '0G Aristotle' : '0G Galileo Testnet',
        nativeCurrency: { name: 'ZeroG', symbol: '0G', decimals: 18 },
      }
    : {
        name: network === 'arbitrum-sepolia' ? 'Arbitrum Sepolia' : 'Robinhood Chain Testnet',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      }
  return defineChain({
    id: NETWORK_CHAIN_ID[network],
    name: meta.name,
    nativeCurrency: meta.nativeCurrency,
    rpcUrls: { default: { http: [NETWORK_RPC[network]] } },
  })
}

export interface ViemClients {
  chain: Chain
  account: PrivateKeyAccount
  publicClient: PublicClient
  walletClient: WalletClient
}

export function makeViemClients(opts: { network: PromusNetwork; privkeyHex: Hex }): ViemClients {
  const chain = ogChain(opts.network)
  const account = privateKeyToAccount(opts.privkeyHex)
  const transport = http(NETWORK_RPC[opts.network])
  const publicClient = createPublicClient({ transport, chain })
  const walletClient = createWalletClient({ transport, account, chain })
  return { chain, account, publicClient, walletClient }
}
