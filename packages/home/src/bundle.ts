import { mkdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import type { IStore, ContentHash } from '@eden/cas';
import { hash as casHash } from '@eden/cas';
import type { Keypair } from '@eden/identity';
import {
  agentIdFromKeypair,
  signObject,
  verifyObject,
  publicKeyFromAgentId,
  canonicalize,
} from '@eden/identity';
import type { HomeManifest } from './manifest.js';

const MANIFEST_TYPE = 'home-manifest';

export interface BundleInput {
  files: Map<string, Uint8Array>; // path -> content
  configs?: Map<string, Uint8Array>; // key -> content
}

function sortedEntries<T>(m: Map<string, T>): [string, T][] {
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

export async function createBundle(opts: {
  store: IStore;
  keypair: Keypair;
  input: BundleInput;
  parent?: ContentHash;
  parentVersion?: number;
}): Promise<{ head: ContentHash; manifest: HomeManifest }> {
  const { store, keypair, input, parent, parentVersion } = opts;
  const files: Record<string, ContentHash> = {};
  for (const [p, data] of sortedEntries(input.files)) files[p] = await store.put(data);
  const configs: Record<string, ContentHash> = {};
  for (const [k, data] of sortedEntries(input.configs ?? new Map<string, Uint8Array>())) {
    configs[k] = await store.put(data);
  }
  const unsigned: Omit<HomeManifest, 'signature'> = {
    version: parentVersion ? parentVersion + 1 : 1,
    agentId: agentIdFromKeypair(keypair),
    ...(parent ? { parentHash: parent } : {}),
    files,
    configs,
    created: Date.now(),
  };
  const signature = signObject(keypair.secretKey, MANIFEST_TYPE, unsigned);
  const manifest: HomeManifest = { ...unsigned, signature };
  const head = await store.put(canonicalize(manifest));
  return { head, manifest };
}

export interface VerifyReport {
  valid: boolean;
  errors: string[];
  depth: number;
}

export async function loadManifest(store: IStore, head: ContentHash): Promise<HomeManifest> {
  const blob = await store.get(head);
  if (!blob) throw new Error(`manifest blob not found: ${head}`);
  if (casHash(blob) !== head) throw new Error(`manifest blob hash mismatch: ${head}`);
  return JSON.parse(new TextDecoder().decode(blob)) as HomeManifest;
}

export async function verifyBundle(opts: {
  store: IStore;
  head: ContentHash;
  depth?: number;
}): Promise<VerifyReport> {
  const { store } = opts;
  const maxDepth = opts.depth ?? 1;
  const errors: string[] = [];
  let walked = 0;
  let current: ContentHash | undefined = opts.head;
  let child: HomeManifest | undefined;

  while (current && walked < maxDepth) {
    let manifest: HomeManifest;
    try {
      manifest = await loadManifest(store, current);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
      break;
    }
    walked++;

    try {
      const pub = publicKeyFromAgentId(manifest.agentId);
      if (!verifyObject(pub, MANIFEST_TYPE, manifest)) {
        errors.push(`invalid signature on manifest ${current}`);
      }
    } catch (e) {
      errors.push(`cannot verify signature on ${current}: ${e instanceof Error ? e.message : String(e)}`);
    }

    for (const [p, h] of Object.entries(manifest.files)) {
      if (!(await store.has(h))) errors.push(`missing file blob ${p}: ${h}`);
    }
    for (const [k, h] of Object.entries(manifest.configs)) {
      if (!(await store.has(h))) errors.push(`missing config blob ${k}: ${h}`);
    }

    if (child) {
      if (child.version !== manifest.version + 1) {
        errors.push(`version chain broken: ${child.version} does not follow ${manifest.version}`);
      }
      if (child.agentId !== manifest.agentId) {
        errors.push(`agentId mismatch between ${current} and its child`);
      }
    }

    child = manifest;
    current = manifest.parentHash;
  }

  return { valid: errors.length === 0, errors, depth: walked };
}

export async function restoreBundle(opts: {
  store: IStore;
  head: ContentHash;
  target: string;
  verify?: boolean;
}): Promise<{ filesRestored: number }> {
  const { store, head, target } = opts;
  if (opts.verify !== false) {
    const report = await verifyBundle({ store, head });
    if (!report.valid) throw new Error(`bundle verification failed: ${report.errors.join('; ')}`);
  }
  const manifest = await loadManifest(store, head);
  const root = path.resolve(target);
  let count = 0;
  for (const [rel, h] of Object.entries(manifest.files)) {
    const dest = path.resolve(root, ...rel.split('/'));
    if (dest !== root && !dest.startsWith(root + path.sep)) {
      throw new Error(`path escapes target directory: ${rel}`);
    }
    const blob = await store.get(h);
    if (!blob) throw new Error(`missing file blob ${rel}: ${h}`);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, blob);
    count++;
  }
  return { filesRestored: count };
}
