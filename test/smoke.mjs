import { generateKeypair, sign, verify, agentIdFromKeypair, publicKeyFromAgentId, canonicalize, signObject, verifyObject, rotateKey, verifyRotationChain } from '@eden/identity';
import { hash, MemoryStore, FsStore } from '@eden/cas';
import { mkdtemp, rm } from 'node:fs/promises';
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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
