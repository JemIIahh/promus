---
slug: identity
title: Identity
description: The iNFT is the agent. Encrypted data slots and a sealed wallet, all carried by the token.
group: Concepts
order: 4
kicker: 'DOCS · CONCEPTS'
voice_word: portable
source: 'packages/core/src/identity'
---

# A portable on-chain identity.

The agent is an ERC-7857 iNFT. Its persona, its memory index, its profile, and its encrypted keystore all live in the token's IntelligentData slots. Transfer the token, you transfer the agent.

## The contract

`PromusAgentNFT` at `0x74F838421A2dA38C20Fe9Fd5E87C8FA5c053DDa3`. CREATE2-deployed, so the same address holds on Arbitrum Sepolia (chainId 421614) and Robinhood Chain testnet (chainId 46630). `name()` returns `"Promus"`. Source: `contracts/src/PromusAgentNFT.sol`.

`mint(operator, entries)` mints to the operator and writes the initial IntelligentData. An update overwrites a slot with a new CID digest. A one-time approval at mint lets the agent EOA update its own slots on subsequent memory syncs without the operator's key.

## The slots

Each slot stores a `bytes32` that is the sha2-256 digest of an encrypted IPFS blob — the persona, the memory index, the profile, and the encrypted agent keystore. The chain never holds the blob, only its content-address digest. Resolving a slot means fetching the blob from IPFS by CID and decrypting it client-side.

Source: [`packages/core/src/identity`](https://github.com/JemIIahh/promus/tree/main/packages/core/src/identity).

## The two wallets

**Operator wallet.** Owns the iNFT. Signs once to mint and approve at init. After that it signs only on cold paths: keystore unlock, transfer, manual inspection.

**Agent EOA.** Generated fresh at init. Pays ongoing gas and runs the agent's economic life. Its private key lives in an ECIES keystore decryptable only by the operator wallet's signature — not a passphrase. The ciphertext is pinned to IPFS and its CID digest anchored in the keystore slot.

Recovery on a new machine reads the keystore slot, downloads the ciphertext from IPFS, prompts the operator wallet to decrypt, and rehydrates the agent.

Source: [`packages/core/src/identity`](https://github.com/JemIIahh/promus/tree/main/packages/core/src/identity), [`packages/cli/src/commands/restore.ts`](https://github.com/JemIIahh/promus/blob/main/packages/cli/src/commands/restore.ts).

## Transfer semantics

When the iNFT moves, the agent's intrinsic partition (persona, identity, memory index) goes with it. The keystore stays anchored but only the new operator can decrypt it, because the encryption is keyed to whatever wallet signs the unlock. Operator-scoped memory does not transfer; the new operator starts clean there.

The agent on the new machine has the same name, the same persona, the same long-term memory — and no memory of the old operator. That asymmetry is the point.

Read [Memory](/docs/memory) next.

Source: [`contracts/src/PromusAgentNFT.sol`](https://github.com/JemIIahh/promus/blob/main/contracts/src/PromusAgentNFT.sol), [`packages/core/src/identity/deployments.ts`](https://github.com/JemIIahh/promus/blob/main/packages/core/src/identity/deployments.ts).
