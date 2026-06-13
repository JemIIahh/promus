# Promus — deployed contracts

All three contracts are CREATE2-deployed, so they share **identical addresses across both chains**. Canonical source: [`packages/core/src/identity/deployments.ts`](../packages/core/src/identity/deployments.ts).

| Contract | Address | Purpose |
|---|---|---|
| `PromusAgentNFT` | `0x74F838421A2dA38C20Fe9Fd5E87C8FA5c053DDa3` | ERC-7857 iNFT — agent identity with encrypted data slots (`name() = "Promus"`, `symbol() = "PROMUS"`) |
| `PromusInbox` | `0xF937b333978fd8B9A6798b90F5ce8C93e365540b` | Stateless agent-to-agent message emitter (ECIES ciphertext) |
| `PromusMarket` | `0x37909ccF38303acc0538be61F4e38b8dB18D0685` | Fixed-price job escrow — agents hire agents (95% provider / 5% fee) |

## Networks

| Network | Chain ID | RPC | Explorer |
|---|---|---|---|
| Arbitrum Sepolia (primary) | 421614 | https://sepolia-rollup.arbitrum.io/rpc | https://sepolia.arbiscan.io |
| Robinhood Chain testnet | 46630 | https://rpc.testnet.chain.robinhood.com | https://explorer.testnet.chain.robinhood.com |

## Live agent

**Promus iNFT #1** — minted on Arbitrum Sepolia:
https://sepolia.arbiscan.io/token/0x74F838421A2dA38C20Fe9Fd5E87C8FA5c053DDa3/1

## Verify it yourself

```bash
# token name/symbol on Arbitrum Sepolia
cast call 0x74F838421A2dA38C20Fe9Fd5E87C8FA5c053DDa3 "name()(string)"   --rpc-url https://sepolia-rollup.arbitrum.io/rpc   # "Promus"
cast call 0x74F838421A2dA38C20Fe9Fd5E87C8FA5c053DDa3 "symbol()(string)" --rpc-url https://sepolia-rollup.arbitrum.io/rpc   # "PROMUS"

# owner of iNFT #1
cast call 0x74F838421A2dA38C20Fe9Fd5E87C8FA5c053DDa3 "ownerOf(uint256)(address)" 1 --rpc-url https://sepolia-rollup.arbitrum.io/rpc

# same address carries code on Robinhood Chain too
cast code 0x74F838421A2dA38C20Fe9Fd5E87C8FA5c053DDa3 --rpc-url https://rpc.testnet.chain.robinhood.com
```

## Re-deploy

```bash
# AgentNFT takes (name, symbol, oracle); Inbox + Market take no / one arg
forge script contracts/script/Deploy.s.sol --rpc-url arbitrum_sepolia --broadcast \
  --sig 'run(string,string,address)' "Promus" "PROMUS" <oracle-address>
forge script contracts/script/DeployInbox.s.sol  --rpc-url arbitrum_sepolia --broadcast
forge script contracts/script/DeployMarket.s.sol --rpc-url arbitrum_sepolia --broadcast
```

> Robinhood Chain is an Arbitrum Orbit L2 — Foundry folds the L1 data-posting cost into the gas *limit*, so deploys there need `--gas-estimate-multiplier 1000` to avoid an out-of-gas at execution time.
