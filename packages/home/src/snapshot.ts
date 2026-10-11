import { readdir, readFile } from 'node:fs/promises';
import * as path from 'node:path';
import type { ContentHash, IStore } from '@eden/cas';
import { hash as casHash } from '@eden/cas';
import type { Keypair } from '@eden/identity';
import type { HomeManifest } from './manifest.js';
import { createBundle, loadManifest } from './bundle.js';

async function walk(dir: string, rel: string, out: Map<string, string>): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) await walk(abs, r, out);
    else if (e.isFile()) out.set(r, abs);
  }
}

export async function snapshot(opts: {
  store: IStore;
  keypair: Keypair;
  root: string;
  parent?: ContentHash;
}): Promise<{ head: ContentHash; manifest: HomeManifest; changed: number; reused: number }> {
  const { store, keypair, root, parent } = opts;
  const parentManifest = parent ? await loadManifest(store, parent) : undefined;

  const paths = new Map<string, string>();
  await walk(root, '', paths);

  const files = new Map<string, Uint8Array>();
  let changed = 0;
  let reused = 0;
  for (const [rel, abs] of paths) {
    const data = new Uint8Array(await readFile(abs));
    files.set(rel, data);
    if (parentManifest && parentManifest.files[rel] === casHash(data)) reused++;
    else changed++;
  }

  const { head, manifest } = await createBundle({
    store,
    keypair,
    input: { files },
    ...(parent ? { parent } : {}),
    ...(parentManifest ? { parentVersion: parentManifest.version } : {}),
  });
  return { head, manifest, changed, reused };
}

export async function diff(
  store: IStore,
  a: ContentHash,
  b: ContentHash,
): Promise<{ added: string[]; removed: string[]; modified: string[]; unchanged: string[] }> {
  const [ma, mb] = await Promise.all([loadManifest(store, a), loadManifest(store, b)]);
  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];
  const unchanged: string[] = [];
  for (const [p, h] of Object.entries(mb.files)) {
    const prev = ma.files[p];
    if (prev === undefined) added.push(p);
    else if (prev === h) unchanged.push(p);
    else modified.push(p);
  }
  for (const p of Object.keys(ma.files)) if (!(p in mb.files)) removed.push(p);
  for (const l of [added, removed, modified, unchanged]) l.sort();
  return { added, removed, modified, unchanged };
}
