import { secp256k1 } from '@noble/curves/secp256k1.js'
import {
  type Hex,
  type PublicClient,
  hexToBytes,
  keccak256,
  recoverPublicKey,
  serializeTransaction,
  toHex,
} from 'viem'

/**
 * Derive the secp256k1 uncompressed public key (`0x04 + x32 + y32`, 65 bytes /
 * 130 hex chars) from a private key. This is the canonical form used by ECIES
 * libraries (eciesjs, eth-crypto) and is what we publish as the `pubkey` text
 * record on an agent's `.0g` subname so other agents can encrypt to it.
 */
export function derivePubkeyHex(privkeyHex: Hex | string): Hex {
  const priv = privkeyHex.startsWith('0x')
    ? hexToBytes(privkeyHex as Hex)
    : hexToBytes(`0x${privkeyHex}`)
  const pub = secp256k1.getPublicKey(priv, false) // false = uncompressed (65 B)
  return toHex(pub)
}

/**
 * Rebuild the unsigned signing payload of a fetched transaction so its hash can
 * be re-derived for public-key recovery. Mirrors the field set viem's
 * `serializeTransaction` expects per tx type (eip1559 / eip2930 / legacy).
 */
function serializeUnsigned(tx: {
  type?: string
  chainId?: number
  nonce: number
  to: `0x${string}` | null
  value: bigint
  gas: bigint
  input: Hex
  maxFeePerGas?: bigint | null
  maxPriorityFeePerGas?: bigint | null
  gasPrice?: bigint | null
  accessList?: unknown
}): Hex {
  const common = {
    chainId: tx.chainId,
    nonce: tx.nonce,
    to: tx.to ?? undefined,
    value: tx.value,
    gas: tx.gas,
    data: tx.input,
  }
  // viem's per-type serialize signatures are stricter than the parsed-tx shape
  // we hand back (e.g. legacy chainId optionality); the re-serialization is
  // runtime-verified by the recovery tests, so loosen the call typing here.
  // biome-ignore lint/suspicious/noExplicitAny: deliberate loosen for re-serialize
  const ser = serializeTransaction as (args: any) => Hex
  if (tx.type === 'eip1559') {
    return ser({
      ...common,
      type: 'eip1559',
      maxFeePerGas: tx.maxFeePerGas ?? 0n,
      maxPriorityFeePerGas: tx.maxPriorityFeePerGas ?? 0n,
      accessList: tx.accessList ?? [],
    })
  }
  if (tx.type === 'eip2930') {
    return ser({ ...common, type: 'eip2930', gasPrice: tx.gasPrice ?? 0n, accessList: tx.accessList ?? [] })
  }
  return ser({ ...common, type: 'legacy', gasPrice: tx.gasPrice ?? 0n })
}

/**
 * Recover the signer's uncompressed secp256k1 public key (`0x04…`, 65 bytes) from
 * a signed transaction on chain.
 *
 * A Promus agent's ECIES encryption key IS its EOA secp256k1 keypair (see
 * {@link derivePubkeyHex}; the inbox listener decrypts with the same agent
 * privkey). So any peer can derive the agent's encryption key from a tx the
 * agent signed — no name service, pubkey registry, or extra publish step. Every
 * agent has signed at least its keystore-anchor tx, so this always has a source.
 *
 * The returned key is the exact form the ECIES layer consumes (it strips the
 * `0x04` prefix). Throws if the tx is unsigned or the recovered key hashes to a
 * different address than expected (when `expectedAddress` is given).
 */
export async function recoverPubkeyFromTx(
  client: PublicClient,
  txHash: Hex,
  expectedAddress?: `0x${string}`,
): Promise<Hex> {
  const tx = await client.getTransaction({ hash: txHash })
  if (tx.r == null || tx.s == null) throw new Error(`tx ${txHash} has no recoverable signature`)
  const signingHash = keccak256(serializeUnsigned(tx))
  const yParity = tx.yParity ?? (tx.v != null ? Number(tx.v % 2n === 0n ? 1n : 0n) : 0)
  const pubkey = await recoverPublicKey({
    hash: signingHash,
    signature: { r: tx.r as Hex, s: tx.s as Hex, yParity },
  })
  if (expectedAddress) {
    const derived = (`0x${keccak256(`0x${pubkey.slice(4)}` as Hex).slice(-40)}`).toLowerCase()
    if (derived !== expectedAddress.toLowerCase()) {
      throw new Error(
        `recovered pubkey hashes to ${derived}, expected ${expectedAddress.toLowerCase()} (wrong tx signer)`,
      )
    }
  }
  return pubkey
}
