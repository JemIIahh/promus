# Promus — demo script

A ~3-minute walkthrough that shows the agent as an on-chain entity: mint → reason → remember → prove on-chain.

## Prereqs (once)

- `bun` installed
- A local IPFS node running: `ipfs daemon` (Kubo)
- `.env` with `ANTHROPIC_API_KEY`, `PROMUS_STORAGE_BACKEND=ipfs`, `PROMUS_IPFS_API_URL=http://127.0.0.1:5001`, and a funded Arbitrum Sepolia operator key
- `promus` on PATH (or `bun packages/cli/bin/promus`)

## 1. Mint the agent (the identity is an on-chain token)

```bash
promus init
```
Talking points while it runs:
- Pick **Arbitrum Sepolia**. No 0G, no compute ledger — the brain is Claude, memory is IPFS.
- It mints an **ERC-7857 iNFT** (`PromusAgentNFT`), funds the agent's own EOA, then **encrypts the keystore and anchors its IPFS CID into the iNFT's data slot**.
- Point out the final summary: `iNFT #N`, agent EOA, `keystore on IPFS`, `brain claude-opus-4-8`.

## 2. The agent reasons and remembers

```bash
promus
```
- Ask: **"Who are you?"** → it introduces itself as **Promus**, a sovereign on-chain agent on Arbitrum, brain on Claude, memory on IPFS.
- Ask it to **remember something** ("remember that my project ships Friday"), then watch the turn **sync encrypted memory to IPFS and anchor the new CID on-chain**.
- Optionally ask it to use a tool (e.g. read a file, check its on-chain balance) to show the tool-calling loop.

## 3. Prove it on-chain

Open the iNFT on Arbiscan:
https://sepolia.arbiscan.io/token/0x74F838421A2dA38C20Fe9Fd5E87C8FA5c053DDa3/1

- The token is named **"Promus"**, owned by your operator wallet.
- The data slots hold the anchored content hashes for the encrypted keystore + memory.

## 4. The punchline: sovereignty

- The agent's identity, memory, and wallet are all recoverable from **just the iNFT** — `promus restore <ref>` on a fresh machine pulls the keystore from IPFS via the on-chain CID and rebuilds the agent.
- Transfer the iNFT and the agent moves to a new operator. The harness is replaceable; the agent is not.

## Shot list (for a recorded demo)

1. Terminal: `promus init` → the summary screen (iNFT + IPFS + Claude)
2. Terminal: `promus` → "who are you?" answer
3. Terminal: a "remember X" turn → the memory-sync/anchor line
4. Browser: the Arbiscan token page showing `name() = "Promus"`, owner = operator
