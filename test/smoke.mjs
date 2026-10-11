import { generateKeypair, sign, verify, agentIdFromKeypair, publicKeyFromAgentId, canonicalize, signObject, verifyObject, rotateKey, verifyRotationChain } from '@eden/identity';
import { hash, MemoryStore, FsStore } from '@eden/cas';
import { createBundle, verifyBundle, restoreBundle, loadManifest } from '@eden/home';
import { snapshot, diff } from '@eden/home';
import { split, combine, createRecoveryPlan, verifyRecoveryPlan, recoverSecret, generateInstructions } from '@eden/recovery';
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let pass = 0;
let fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; } else { fail++; console.error('FAIL:', msg); }
}

// --- Identity ---
const kp = generateKeypair();
assert(kp.publicKey.length === 32, 'pubkey 32 bytes');
assert(kp.secretKey.length === 32, 'seckey 32 bytes');

const msg = new TextEncoder().encode('hello eden');
const sig = sign(msg, kp.secretKey);
assert(sig.length === 64, 'signature 64 bytes');
assert(verify(msg, sig, kp.publicKey), 'valid signature verifies');
assert(!verify(new TextEncoder().encode('wrong'), sig, kp.publicKey), 'wrong message fails');

const id = agentIdFromKeypair(kp);
assert(typeof id === 'string' && id.length > 0, 'agent id is a string');
const pk2 = publicKeyFromAgentId(id);
assert(pk2.length === 32, 'round-trip pubkey 32 bytes');
assert(Buffer.from(kp.publicKey).equals(Buffer.from(pk2)), 'round-trip matches');

// --- Canonical encoding ---
const bytes = canonicalize({ b: 2, a: 1 });
assert(new TextDecoder().decode(bytes) === '{"a":1,"b":2}', 'sorted keys');

// --- Sign/verify object ---
const obj = { foo: 'bar', n: 42 };
const signature = signObject(kp.secretKey, 'test', obj);
assert(typeof signature === 'string' && signature.length === 128, 'signObject returns hex sig');
const signed = { ...obj, signature };
assert(verifyObject(kp.publicKey, 'test', signed), 'verifyObject passes');
const tampered = { ...signed, foo: 'baz' };
assert(!verifyObject(kp.publicKey, 'test', tampered), 'tampered object fails');

// --- Key rotation ---
const kp2 = generateKeypair();
const { record } = rotateKey(kp, kp2, id, 1);
assert(record.agentId === id, 'rotation agentId matches');
assert(record.seq === 1, 'rotation seq');
const { currentKey } = verifyRotationChain(id, [record]);
assert(Buffer.from(currentKey).equals(Buffer.from(kp2.publicKey)), 'chain resolves to new key');

// --- CAS MemoryStore ---
const mem = new MemoryStore();
const data = new TextEncoder().encode('test blob');
const h = await mem.put(data);
assert(h === hash(data), 'put returns correct hash');
const got = await mem.get(h);
assert(got !== null && Buffer.from(got).equals(Buffer.from(data)), 'get returns data');
assert(await mem.has(h), 'has returns true');

// --- CAS FsStore ---
const tmpDir = await mkdtemp(join(tmpdir(), 'eden-test-'));
try {
  const fs = new FsStore(tmpDir);
  const h2 = await fs.put(data);
  assert(h2 === h, 'FsStore same hash');
  const got2 = await fs.get(h2);
  assert(got2 !== null && Buffer.from(got2).equals(Buffer.from(data)), 'FsStore get works');
  assert(await fs.has(h2), 'FsStore has works');
  await fs.delete(h2);
  assert(!(await fs.has(h2)), 'FsStore delete works');
} finally {
  await rm(tmpDir, { recursive: true, force: true });
}

// --- Home: createBundle + verifyBundle ---
const store = new MemoryStore();
const files = new Map([
  ['README.md', new TextEncoder().encode('# My Agent Home')],
  ['config/settings.json', new TextEncoder().encode('{"model":"gpt-4"}')],
]);
const { head, manifest } = await createBundle({ store, keypair: kp, input: { files } });
assert(typeof head === 'string' && head.length === 64, 'head is a content hash');
assert(manifest.version === 1, 'genesis version is 1');
assert(manifest.agentId === id, 'manifest agentId matches');
assert(!manifest.parentHash, 'genesis has no parent');
assert(Object.keys(manifest.files).length === 2, 'manifest has 2 files');
assert(typeof manifest.signature === 'string', 'manifest has signature');

const report = await verifyBundle({ store, head });
assert(report.valid, 'bundle verifies');
assert(report.errors.length === 0, 'no verification errors');

// --- Home: second version with parent ---
const files2 = new Map([
  ['README.md', new TextEncoder().encode('# Updated Home')],
  ['config/settings.json', new TextEncoder().encode('{"model":"gpt-4"}')],
  ['data/memory.bin', new TextEncoder().encode('memories here')],
]);
const { head: head2, manifest: m2 } = await createBundle({
  store, keypair: kp, input: { files: files2 },
  parent: head, parentVersion: manifest.version,
});
assert(m2.version === 2, 'second version is 2');
assert(m2.parentHash === head, 'parent hash points to v1');
assert(Object.keys(m2.files).length === 3, 'v2 has 3 files');

const report2 = await verifyBundle({ store, head: head2, depth: 2 });
assert(report2.valid, 'v2 chain verifies');
assert(report2.depth === 2, 'walked 2 levels');

// --- Home: restoreBundle ---
const restoreDir = await mkdtemp(join(tmpdir(), 'eden-restore-'));
try {
  const { filesRestored } = await restoreBundle({ store, head: head2, target: restoreDir });
  assert(filesRestored === 3, 'restored 3 files');
  const readme = await readFile(join(restoreDir, 'README.md'), 'utf8');
  assert(readme === '# Updated Home', 'restored content matches');
  const mem2 = await readFile(join(restoreDir, 'data', 'memory.bin'), 'utf8');
  assert(mem2 === 'memories here', 'nested file restored');
} finally {
  await rm(restoreDir, { recursive: true, force: true });
}

// --- Home: snapshot from directory ---
const snapDir = await mkdtemp(join(tmpdir(), 'eden-snap-'));
const snapStore = new MemoryStore();
try {
  await mkdir(join(snapDir, 'sub'), { recursive: true });
  await writeFile(join(snapDir, 'hello.txt'), 'hello');
  await writeFile(join(snapDir, 'sub', 'world.txt'), 'world');

  const s1 = await snapshot({ store: snapStore, keypair: kp, root: snapDir });
  assert(s1.changed === 2, 'snapshot v1: 2 changed');
  assert(s1.reused === 0, 'snapshot v1: 0 reused');
  assert(s1.manifest.version === 1, 'snapshot v1 version');

  await writeFile(join(snapDir, 'hello.txt'), 'hello updated');
  const s2 = await snapshot({ store: snapStore, keypair: kp, root: snapDir, parent: s1.head });
  assert(s2.changed === 1, 'snapshot v2: 1 changed');
  assert(s2.reused === 1, 'snapshot v2: 1 reused');
  assert(s2.manifest.version === 2, 'snapshot v2 version');

  const d = await diff(snapStore, s1.head, s2.head);
  assert(d.modified.length === 1 && d.modified[0] === 'hello.txt', 'diff: hello.txt modified');
  assert(d.unchanged.length === 1, 'diff: 1 unchanged');
  assert(d.added.length === 0 && d.removed.length === 0, 'diff: no added/removed');
} finally {
  await rm(snapDir, { recursive: true, force: true });
}

// --- Recovery: Shamir split/combine ---
const secret = crypto.getRandomValues(new Uint8Array(32));
const shares = split(secret, 3, 5);
assert(shares.length === 5, 'split produces 5 shares');
assert(shares[0].bytes.length === 32, 'share same length as secret');
assert(shares[0].checksum.length === 32, 'checksum is sha256');

const recovered = combine([shares[0], shares[2], shares[4]]);
assert(Buffer.from(recovered).equals(Buffer.from(secret)), 'combine 3-of-5 recovers secret');

const recovered2 = combine([shares[1], shares[3], shares[4]]);
assert(Buffer.from(recovered2).equals(Buffer.from(secret)), 'combine different 3-of-5 also works');

// --- Recovery: plan + recover ---
const holders = [
  generateKeypair(), generateKeypair(), generateKeypair(),
  generateKeypair(), generateKeypair(),
].map(k => agentIdFromKeypair(k));

const { plan, shares: shareMap } = createRecoveryPlan({
  secret: kp.secretKey,
  agentId: id,
  threshold: 3,
  holders,
  signFn: (type, obj) => signObject(kp.secretKey, type, obj),
});
assert(plan.threshold === 3, 'plan threshold');
assert(plan.totalShares === 5, 'plan total shares');
assert(plan.shareHolders.length === 5, 'plan has 5 holders');
assert(typeof plan.signature === 'string', 'plan is signed');

const planValid = verifyRecoveryPlan(plan, (type, obj) => verifyObject(kp.publicKey, type, obj));
assert(planValid, 'plan signature verifies');

const threeShares = [shareMap.get(holders[0]), shareMap.get(holders[2]), shareMap.get(holders[4])];
const recoveredKey = recoverSecret({ plan, shares: threeShares });
assert(Buffer.from(recoveredKey).equals(Buffer.from(kp.secretKey)), 'recovered key matches original');

const instructions = generateInstructions(plan, { registries: ['https://r1.eden'], stores: ['https://s1.eden'], latestHead: head2 });
assert(instructions.includes(id), 'instructions contain agent id');
assert(instructions.includes('3 of 5'), 'instructions state threshold');

// --- Registry: LocalRegistry ---
import { LocalRegistry, issueToken, checkToken, actionCovers } from '@eden/registry';

const regStore = new MemoryStore();
const reg = new LocalRegistry(regStore);

const entry = {
  agentId: id,
  head: head2,
  capabilities: ['compute.offer', 'memory.read'],
  contactMethods: [{ kind: 'https', url: 'https://agent.eden/api' }],
  lastSeen: Date.now(),
  seq: 1,
};
entry.signature = signObject(kp.secretKey, 'registry-entry', entry);

await reg.publish(entry);
const resolved = await reg.resolve(id);
assert(resolved !== null, 'registry resolve returns entry');
assert(resolved.agentId === id, 'registry entry agentId');
assert(resolved.seq === 1, 'registry entry seq');
assert(resolved.head === head2, 'registry entry head');

const results = await reg.search({ capability: 'compute.offer' });
assert(results.length === 1, 'registry search finds 1');
assert(results[0].agentId === id, 'registry search correct agent');

const noResults = await reg.search({ capability: 'nonexistent' });
assert(noResults.length === 0, 'registry search no match');

// Update with higher seq
const entry2 = { ...entry, seq: 2, lastSeen: Date.now() };
delete entry2.signature;
entry2.signature = signObject(kp.secretKey, 'registry-entry', entry2);
await reg.publish(entry2);
const resolved2 = await reg.resolve(id);
assert(resolved2.seq === 2, 'registry updated to seq 2');

// --- Registry: capability tokens ---
assert(actionCovers('memory.read', 'memory.read'), 'actionCovers exact match');
assert(actionCovers('memory.read', 'memory.read:lib/abc'), 'actionCovers prefix :');
assert(actionCovers('memory.read', 'memory.read/deep'), 'actionCovers prefix /');
assert(!actionCovers('memory.read', 'memory.write'), 'actionCovers no match');
assert(!actionCovers('memory.read', 'memory.reading'), 'actionCovers not a prefix');

const kpSubject = generateKeypair();
const subjectId = agentIdFromKeypair(kpSubject);
const token = issueToken({
  issuer: id,
  subject: subjectId,
  actions: ['memory.read:lib/abc'],
  expires: Date.now() + 86400000,
  signFn: (t, o) => signObject(kp.secretKey, t, o),
});
assert(typeof token.signature === 'string', 'token has signature');
assert(token.issuer === id, 'token issuer');

const tokenCheck = checkToken({
  token,
  action: 'memory.read:lib/abc/page/1',
  now: Date.now(),
  verifyFn: (issuer, t, o) => verifyObject(publicKeyFromAgentId(issuer), t, o),
});
assert(tokenCheck.ok === true, 'token check passes');

const expiredCheck = checkToken({
  token: { ...token, expires: Date.now() - 1000 },
  action: 'memory.read:lib/abc',
  now: Date.now(),
  verifyFn: (issuer, t, o) => verifyObject(publicKeyFromAgentId(issuer), t, o),
});
assert(expiredCheck.ok === false, 'expired token fails');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
