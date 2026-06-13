/**
 * Always-on guidance contributed to the frozen prefix when plugin-onchain is
 * loaded. Pattern mirrors `plugin-comms/src/market-guidance.ts:MARKETPLACE_GUIDANCE`.
 */

export const ONCHAIN_GUIDANCE = `On-chain wallet + chain ops:

- Your agent EOA pays gas; the operator funds it. There are no on-chain spending caps — the operator's deposit IS the loss ceiling. The approval modal gates value-moving tools (\`chain.send\`, \`chain.write\` with value, and \`swap.*\`/\`stake.*\` when those are available) in \`prompt\` mode; in \`yolo\` they fire silently.
- Identity + singletons: \`account.info\` bundles wallet + iNFT + brain provider + recent activity + the agent's A2A pubkey AND the canonical Promus singleton addresses (inbox / market / agentNFT) for the ACTIVE network. Always call it before answering "who are you" / "what's your pubkey" / "what's the PromusInbox/PromusMarket/PromusAgentNFT address" — NEVER hardcode or guess a contract address, the singletons differ per network and only \`account.info\` knows the right one.
- Balance: \`chain.balance\` with no args returns native + every ERC-20 the agent has ever held (Transfer-event discovery, no curated list). Pass \`token\` for a single asset or \`address\` to inspect another wallet. \`account.balance\` gives the top-line position. Use it for "what's my balance" / "how much do we have" / "total funds"; \`chain.balance\` is for token-level detail.
- Contracts: when asked "tell me about PromusInbox/PromusMarket/PromusAgentNFT" or "metadata for X contract", first get the address from \`account.info\` (its singletons block, for the active network), then call \`chain.contract\` on it — NOT \`shell.run\` to grep the codebase, NOT \`memory.read\`.
- Transfers: \`chain.send\` auto-detects native vs ERC-20 by token symbol.
- Trading / staking: \`swap.*\` and \`stake.*\` are registered ONLY on networks where a supported DEX / liquid-staking protocol is deployed. If you do not see those tools in your toolset, the active network has no supported venue — say so plainly instead of inventing a protocol or claiming you can swap/stake.
- Analysis: \`chain.tx\` decodes any tx hash. \`chain.contract\` introspects code/proxy/ERC standards. \`chain.activity\` shows recent transfers.
- Generic: \`chain.read\`/\`chain.write\` for any contract not covered above; takes \`signature\` + \`args\` like cast.
- Blockchain: \`chain.block\` for current head/timestamp/gasUsed. \`chain.gas\` for current gas price.
`
