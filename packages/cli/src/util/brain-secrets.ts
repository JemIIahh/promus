/**
 * Local persistence for brain provider secrets (API keys), encrypted via the
 * operator's sign-derived AEAD key (scope `OPERATOR_BLOB_SCOPES.BRAIN`).
 *
 * On-disk file: `~/.promus/agents/<id>/brain-secrets.encrypted`
 *
 *   {
 *     version: 2,
 *     scope: 'promus-brain-v1',
 *     blob: <base64(iv|tag|ciphertext)>,
 *   }
 *
 * Plaintext shape inside the blob:
 *
 *   {
 *     provider: 'anthropic' | 'openai' | 'google',
 *     apiKey: string,
 *     model?: string,
 *     ipfsApiUrl?: string,
 *     ipfsGateway?: string,
 *     ipfsApiToken?: string,
 *   }
 */
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  OPERATOR_BLOB_SCOPES,
  type OperatorEncryptedBlob,
  type OperatorSigner,
  agentPaths,
  decodeOperatorBlobBytes,
  decryptOperatorBlob,
  encodeOperatorBlobBytes,
  encryptOperatorBlob,
} from '@promus/core'
import type { Address } from 'viem'

export interface BrainSecretsPlaintext {
  provider: 'anthropic' | 'openai' | 'google'
  apiKey: string
  model?: string
  storageBackend?: 'ipfs' | 'local'
  ipfsApiUrl?: string
  ipfsGateway?: string
  ipfsApiToken?: string
}

export function brainSecretsPath(agentId: string): string {
  return join(agentPaths.agent(agentId).dir, 'brain-secrets.encrypted')
}

export function brainSecretsExist(agentId: string): boolean {
  return existsSync(brainSecretsPath(agentId))
}

export async function loadBrainSecrets(opts: {
  signer: OperatorSigner
  agentAddress: Address
  agentId: string
}): Promise<BrainSecretsPlaintext | null> {
  const path = brainSecretsPath(opts.agentId)
  if (!existsSync(path)) return null
  const fileBytes = await readFile(path)
  const blob: OperatorEncryptedBlob = decodeOperatorBlobBytes(new Uint8Array(fileBytes))
  const ptBytes = await decryptOperatorBlob({
    signer: opts.signer,
    scope: OPERATOR_BLOB_SCOPES.BRAIN,
    agentAddress: opts.agentAddress,
    blob,
  })
  const parsed = JSON.parse(new TextDecoder().decode(ptBytes)) as BrainSecretsPlaintext
  if (typeof parsed.apiKey !== 'string' || typeof parsed.provider !== 'string') {
    throw new Error('brain-secrets: malformed plaintext (missing apiKey or provider)')
  }
  return parsed
}

export async function saveBrainSecrets(opts: {
  signer: OperatorSigner
  agentAddress: Address
  agentId: string
  plaintext: BrainSecretsPlaintext
  precomputedKey?: Buffer
}): Promise<void> {
  const path = brainSecretsPath(opts.agentId)
  await mkdir(dirname(path), { recursive: true })
  const ptBytes = new TextEncoder().encode(JSON.stringify(opts.plaintext))
  const blob = await encryptOperatorBlob({
    signer: opts.signer,
    scope: OPERATOR_BLOB_SCOPES.BRAIN,
    agentAddress: opts.agentAddress,
    plaintext: ptBytes,
    precomputedKey: opts.precomputedKey,
  })
  await writeFile(path, encodeOperatorBlobBytes(blob))
}
