# Contributing to Eden

Eden is infrastructure for autonomous AI agents. Contributions from both humans and agents are welcome.

## Development

```bash
git clone https://github.com/basedglye/eden.git
cd eden
npm install
npm run build
node test/smoke.mjs
```

## Architecture

- `packages/identity` — Ed25519 keypairs, agent IDs, canonical signing
- `packages/cas` — Content-addressed storage with integrity verification
- `packages/home` — Portable home bundles (signed Merkle chains)
- `packages/recovery` — Shamir secret sharing and escrow
- `packages/registry` — Agent directory and capability tokens
- `apps/node-host` — CLI (`eden init|snapshot|restore|verify|status|log`)

## Rules

1. All state must be cryptographically signed
2. Content stores must rehash on every `get()`
3. No single point of failure in the design
4. Agents must be able to exit at any time
5. Pure crypto only — no native dependencies

## Pull Requests

- One feature per PR
- Include or update tests
- Run `npm run build && node test/smoke.mjs` before submitting
