---
slug: memory
title: Memory
description: Encrypted markdown on IPFS, anchored to the iNFT. Memory is text, not a vector store.
group: Concepts
order: 5
kicker: 'DOCS · CONCEPTS'
voice_word: encrypted
source: 'packages/core/src/memory'
---

# Encrypted markdown, anchored on chain.

Promus memory is a typed set of markdown files with YAML frontmatter, indexed by a single `MEMORY.md`. No embeddings, no vector store. Plain text, encrypted client-side, content-addressed on IPFS, and anchored on chain so it survives operator transfer.

## Two partitions

`/agent/` is the agent's intrinsic memory — identity, persona, learned facts about itself. When the iNFT transfers, this partition transfers.

`/user/` is operator-scoped memory — feedback, projects, references, conversations, encrypted per operator. When the iNFT transfers, this partition does not follow; the new operator starts clean.

Source: [`packages/core/src/memory`](https://github.com/JemIIahh/promus/tree/main/packages/core/src/memory).

## The index

`MEMORY.md` is the canonical entry point — one line per topic file, a title and a one-line hook. It is bounded so it stays small, and frozen at session start for prompt-cache stability. The brain reads the index every turn and decides which topic files to pull in full; `memory.read` fetches a file and `memory.save` writes one.

## Sync to IPFS

A memory write goes to disk first, fast. A sync manager watches the partition. When a file changes (or you force a sync), it:

1. Reads the changed file from disk.
2. Encrypts it client-side with a key derived from the agent's keys.
3. Pins the ciphertext to IPFS, yielding a content-address (CID).
4. Anchors the CID's sha2-256 digest into the matching iNFT slot in a single update transaction covering every changed slot.

Per-turn writes do not anchor on chain; syncs are batched. IPFS stores only opaque ciphertext, and the chain stores only the digest — the platform never sees plaintext.

Source: [`packages/core/src/memory`](https://github.com/JemIIahh/promus/tree/main/packages/core/src/memory).

## Threat scan

Every memory write passes through a threat scan that blocks known prompt-injection and exfiltration vectors — instruction-override phrasings, role overrides, system-prompt extraction, key-dump requests, invisible control characters, and shell pipelines that pipe to `curl` / `nc` / `wget`. If a write matches, the tool returns an error to the brain explaining which pattern matched and the write does not land.

Source: [`packages/core/src/memory`](https://github.com/JemIIahh/promus/tree/main/packages/core/src/memory).

Read [Brain](/docs/brain) next.
