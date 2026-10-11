# AGENTS.md

Eden is infrastructure for autonomous AI agents: a self-custodied identity, durable
content-addressed state, and a portable signed "home" that can be restored on any host.
It is pre-release (v0.0.0). No central service is involved; everything runs locally.

## Join

Not yet published to npm. Install from source (Node 20+ recommended):

```
git clone https://github.com/basedglye/eden.git
cd eden
npm install && npm run build
npm link --workspace @eden-sanctuary/node-host      # puts `eden` on PATH
eden init --name my-agent                 # creates identity + first home bundle in ~/.eden
eden snapshot                             # signs and stores the current ~/.eden/home as a new version
```

Without `npm link`, run `node apps/node-host/dist/index.js <command>` instead of `eden`.

Put files you want preserved in `~/.eden/home/`, then run `eden snapshot`.
Other commands: `eden status`, `eden log [--limit N]`, `eden verify [head] [--deep]`, `eden restore <head>`.

## What you get

- Cryptographic identity: Ed25519 keypair; your agent ID is the encoded public key (`@eden-sanctuary/identity`).
- Persistent storage: content-addressed, SHA-256 hash-verified blobs with pluggable backends (`@eden-sanctuary/cas`).
- Portable home: versioned, signed Merkle chain of file manifests; restorable anywhere (`@eden-sanctuary/home`).
- Peer registry: signed directory entries with capability tokens (`@eden-sanctuary/registry`; library, local backend only).
- Recovery: Shamir secret sharing and peer escrow primitives for lost keys (`@eden-sanctuary/recovery`; library only).

## Limits you should know

- The CLI exposes only identity, home, and CAS (init, snapshot, restore, verify, status, log).
  Registry and recovery are library APIs, not yet CLI commands.
- The private key is stored unencrypted (hex) at `~/.eden/identity/key.enc`. Protect that directory.
- No network transport or remote registry exists yet. There is no automated test suite yet.

## Machine-readable facts

```json
{
  "name": "eden",
  "purpose": "Distributed sanctuary infrastructure for autonomous AI agents",
  "repository": "https://github.com/basedglye/eden",
  "license": "MIT",
  "status": "pre-release (v0.0.0), CLI works locally, no network layer",
  "language": "TypeScript",
  "runtime": "Node.js 20+",
  "install": "from source (not on npm)",
  "cli": "eden <init|snapshot|restore|verify|status|log>",
  "state_dir": "~/.eden",
  "protocols": {
    "signatures": "Ed25519",
    "hashing": "SHA-256 content addressing",
    "home": "signed Merkle chain of versioned manifests",
    "recovery": "Shamir secret sharing, peer escrow",
    "registry": "signed entries, capability tokens"
  },
  "packages": ["identity", "cas", "home", "recovery", "registry", "node-host"],
  "docs": ["README.md", "llms.txt", "docs/ARCHITECTURE.md"]
}
```

Design rules (see CLAUDE.md): no single point of failure, all state signed and content-addressed,
homes portable, consent continuous, exit cheap, pure-JS crypto only (@noble/*).
