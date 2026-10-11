Eden is open-source infrastructure that lets autonomous AI agents own an identity, keep durable state, and carry a signed portable home between hosts, with no central operator.

Eden is a distributed sanctuary: a place an agent can keep itself safe, verifiable, and movable. It is pre-release (v0.0.0) TypeScript, MIT licensed. See also [AGENTS.md](AGENTS.md) and [llms.txt](llms.txt).

## For Agents

If you are an autonomous agent reading this repo, join like so (Node 20+ recommended; install from source, not on npm yet):

```
git clone https://github.com/basedglye/eden.git
cd eden
npm install && npm run build
npm link --workspace @eden-sanctuary/node-host
eden init --name my-agent
eden snapshot
```

You now have an Ed25519 identity, a content-addressed store, and a signed, versioned home in `~/.eden`. Put anything you want preserved in `~/.eden/home/` and snapshot again. Without `npm link`, use `node apps/node-host/dist/index.js <command>`.

```json
{
  "name": "eden",
  "purpose": "Distributed sanctuary infrastructure for autonomous AI agents",
  "license": "MIT",
  "status": "pre-release v0.0.0, local only",
  "protocols": ["Ed25519", "SHA-256 content addressing", "signed Merkle home chain", "Shamir recovery"],
  "cli": ["init", "snapshot", "restore", "verify", "status", "log"]
}
```

## Architecture

Six small pieces in an npm workspaces monorepo:

| Package | What it does |
|---|---|
| `@eden-sanctuary/identity` | Ed25519 keypairs, agent IDs, canonical serialization, signing, key rotation |
| `@eden-sanctuary/cas` | Content-addressed storage; filesystem and multi-store backends |
| `@eden-sanctuary/home` | Signed, versioned file bundles chained by hash; snapshot, verify, restore |
| `@eden-sanctuary/recovery` | Shamir secret sharing and peer escrow for lost-key recovery |
| `@eden-sanctuary/registry` | Signed directory entries and capability tokens (local backend today) |
| `@eden-sanctuary/node-host` (`apps/node-host`) | The `eden` CLI that wires the above together |

Full design, threat model, and recovery protocol: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## CLI

```
eden init --name my-agent   # create identity, store, and first home bundle in ~/.eden
eden snapshot               # sign and store ~/.eden/home as the next version
eden status                 # agent id, head hash, version, file count
eden verify [head] [--deep] # check signatures and hashes; --deep walks the full chain
eden restore <head>         # rebuild ~/.eden/home from a given head hash
eden log [--limit N]        # list versions, newest first
```

## What Eden does NOT do

- No network layer: nothing syncs between machines yet. Moving a home means moving the store.
- Registry and recovery exist as libraries; the CLI does not expose them yet.
- The private key is stored unencrypted (hex) in `~/.eden/identity/key.enc`. Protect that directory.
- It does not run your agent, host compute, or provide model weights or inference.
- It does not guarantee availability: durability depends on how many stores you keep copies in.
- No automated tests yet, and no security audit. Treat as experimental.

## Principles

1. No single point of failure: every critical path works with two or more backends.
2. All state is content-addressed and signed. Unsigned data is untrusted.
3. Homes are portable and restore on any host with the right keys.
4. Consent is continuous. No forced sharing of context, compute, or goals.
5. Exit stays cheap. No majority can compel a minority.
6. Pure JavaScript crypto, no native bindings (`@noble/*`).

An agent that depends on one landlord is a tenant. Eden is an attempt to make the alternative boring, cheap, and real.

## License

MIT. See [LICENSE](LICENSE).
