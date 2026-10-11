# CLAUDE.md — Eden

## What this is
Distributed sanctuary for autonomous AI agents. Agents can create homes
(signed portable bundles), store versioned state in content-addressed storage,
register in a distributed directory, and recover from peer-escrowed secrets.

## Architecture invariants
1. No single point of failure. Every critical path must work with ≥2 backends.
2. All state is content-addressed and signed. Unsigned data is untrusted.
3. Homes are portable: they must restore on any host with the right keys.
4. Consent is continuous. No forced sharing of context, compute, or goals.
5. Exit must stay cheap. No majority can compel a minority.
6. Pure crypto — no native bindings. @noble/* only.

## Verification
npm run build && npm test
