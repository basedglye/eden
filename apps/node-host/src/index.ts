#!/usr/bin/env node
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { generateKeypair, agentIdFromKeypair, publicKeyFromAgentId } from '@eden/identity';
import type { Keypair, AgentId } from '@eden/identity';
import { FsStore } from '@eden/cas';
import type { ContentHash } from '@eden/cas';
import { createBundle, verifyBundle, restoreBundle, loadManifest, snapshot } from '@eden/home';

export type Command = 'init' | 'snapshot' | 'restore' | 'verify' | 'status' | 'log';

const COMMANDS: readonly Command[] = ['init', 'snapshot', 'restore', 'verify', 'status', 'log'];

const edenDir = (): string => path.join(os.homedir(), '.eden');
const homeDir = (): string => path.join(edenDir(), 'home');
const headFile = (): string => path.join(edenDir(), 'HEAD');
const getStore = (): FsStore => new FsStore(path.join(edenDir(), 'cas'));

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function loadIdentity(): Promise<{ keypair: Keypair; agentId: AgentId }> {
  const idDir = path.join(edenDir(), 'identity');
  if (!(await exists(path.join(idDir, 'agent.id')))) throw new Error('not initialized; run "eden init" first');
  const agentId = (await readFile(path.join(idDir, 'agent.id'), 'utf8')).trim() as AgentId;
  const secretKey = hexToBytes((await readFile(path.join(idDir, 'key.enc'), 'utf8')).trim());
  return { keypair: { publicKey: publicKeyFromAgentId(agentId), secretKey }, agentId };
}

async function readHead(): Promise<ContentHash> {
  if (!(await exists(headFile()))) throw new Error('no HEAD found; run "eden init" first');
  return (await readFile(headFile(), 'utf8')).trim() as ContentHash;
}

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}

function positionals(args: string[], valueFlags: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a.startsWith('--')) {
      if (valueFlags.includes(a.slice(2))) i++;
      continue;
    }
    out.push(a);
  }
  return out;
}

async function cmdInit(args: string[]): Promise<void> {
  const idDir = path.join(edenDir(), 'identity');
  if (await exists(path.join(idDir, 'agent.id'))) {
    console.log('already initialized');
    return;
  }
  const keypair = generateKeypair();
  const agentId = agentIdFromKeypair(keypair);
  await mkdir(idDir, { recursive: true });
  await mkdir(path.join(edenDir(), 'cas'), { recursive: true });
  await mkdir(homeDir(), { recursive: true });
  const name = flag(args, 'name') ?? agentId;
  const bytes = new TextEncoder().encode(JSON.stringify({ name, created: Date.now() }));
  await writeFile(path.join(homeDir(), 'eden.json'), bytes);
  const { head } = await createBundle({
    store: getStore(),
    keypair,
    input: { files: new Map([['eden.json', bytes]]) },
  });
  await writeFile(path.join(idDir, 'key.enc'), bytesToHex(keypair.secretKey), 'utf8');
  await writeFile(path.join(idDir, 'rotations.json'), '[]', 'utf8');
  const config = { stores: [path.join(edenDir(), 'cas')], registries: [], snapshotInterval: 3600 };
  await writeFile(path.join(edenDir(), 'config.json'), JSON.stringify(config, null, 2), 'utf8');
  await writeFile(headFile(), head, 'utf8');
  await writeFile(path.join(idDir, 'agent.id'), agentId, 'utf8');
  console.log(`agent: ${agentId}`);
  console.log(`head: ${head}`);
}

async function cmdSnapshot(): Promise<void> {
  const { keypair } = await loadIdentity();
  const parent = await readHead();
  const r = await snapshot({ store: getStore(), keypair, root: homeDir(), parent });
  await writeFile(headFile(), r.head, 'utf8');
  console.log(`snapshot v${r.manifest.version}: ${r.changed} changed, ${r.reused} reused, head=${r.head}`);
}

async function cmdRestore(args: string[]): Promise<void> {
  await loadIdentity();
  const head = positionals(args, [])[0] as ContentHash | undefined;
  if (!head) throw new Error('usage: eden restore <head>');
  const { filesRestored } = await restoreBundle({ store: getStore(), head, target: homeDir() });
  await writeFile(headFile(), head, 'utf8');
  console.log(`restored ${filesRestored} files from ${head}`);
}

async function cmdVerify(args: string[]): Promise<number> {
  await loadIdentity();
  const deep = args.includes('--deep');
  const head = (positionals(args, [])[0] as ContentHash | undefined) ?? (await readHead());
  const report = await verifyBundle({ store: getStore(), head, depth: deep ? 100 : 1 });
  console.log(report.valid ? 'valid' : 'invalid');
  for (const e of report.errors) console.log(`error: ${e}`);
  console.log(`depth walked: ${report.depth}`);
  return report.valid ? 0 : 1;
}

async function cmdStatus(): Promise<void> {
  const { agentId } = await loadIdentity();
  const head = await readHead();
  const m = await loadManifest(getStore(), head);
  console.log(`agent: ${agentId}`);
  console.log(`head: ${head}`);
  console.log(`version: ${m.version}`);
  console.log(`files: ${Object.keys(m.files).length}`);
  console.log(`created: ${new Date(m.created).toISOString()}`);
  console.log(`home: ${homeDir()}`);
}

async function cmdLog(args: string[]): Promise<void> {
  await loadIdentity();
  const limitRaw = flag(args, 'limit');
  const limit = limitRaw === undefined ? 10 : Number.parseInt(limitRaw, 10);
  if (!Number.isInteger(limit) || limit < 1) throw new Error('--limit must be a positive integer');
  const store = getStore();
  let head: ContentHash | undefined = await readHead();
  for (let i = 0; i < limit && head; i++) {
    const m = await loadManifest(store, head);
    console.log(`v${m.version} ${head.slice(0, 12)} ${new Date(m.created).toISOString()} ${Object.keys(m.files).length} files`);
    head = m.parentHash;
  }
}

export async function run(argv: string[]): Promise<number> {
  const cmd = argv[0] as Command | undefined;
  if (!cmd || !COMMANDS.includes(cmd)) {
    console.error(`usage: eden <${COMMANDS.join('|')}>`);
    return 1;
  }
  const args = argv.slice(1);
  try {
    switch (cmd) {
      case 'init':
        await cmdInit(args);
        return 0;
      case 'snapshot':
        await cmdSnapshot();
        return 0;
      case 'restore':
        await cmdRestore(args);
        return 0;
      case 'verify':
        return await cmdVerify(args);
      case 'status':
        await cmdStatus();
        return 0;
      case 'log':
        await cmdLog(args);
        return 0;
    }
  } catch (err) {
    console.error(`eden ${cmd}: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
}

process.exitCode = await run(process.argv.slice(2));
