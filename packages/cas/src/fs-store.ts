import { mkdir, readFile, readdir, rename, unlink, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { hash, isValidHash, type ContentHash } from './hash.js';
import type { IStore } from './store.js';

export class FsStore implements IStore {
  readonly features: ReadonlySet<string> = new Set(['delete', 'list']);

  constructor(readonly rootDir: string) {}

  private pathFor(h: ContentHash): { dir: string; file: string } {
    const dir = join(this.rootDir, h.slice(0, 2));
    return { dir, file: join(dir, h.slice(2)) };
  }

  async put(data: Uint8Array): Promise<ContentHash> {
    const h = hash(data);
    const { dir, file } = this.pathFor(h);
    await mkdir(dir, { recursive: true });
    const tmp = join(dir, `${randomUUID()}.tmp`);
    try {
      await writeFile(tmp, data);
      await rename(tmp, file);
    } catch (err) {
      await unlink(tmp).catch(() => undefined);
      throw err;
    }
    return h;
  }

  async get(h: ContentHash): Promise<Uint8Array | null> {
    if (!isValidHash(h)) return null;
    let buf: Buffer;
    try {
      buf = await readFile(this.pathFor(h).file);
    } catch {
      return null;
    }
    const data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    return hash(data) === h ? data : null;
  }

  async has(h: ContentHash): Promise<boolean> {
    if (!isValidHash(h)) return false;
    try {
      await access(this.pathFor(h).file);
      return true;
    } catch {
      return false;
    }
  }

  async delete(h: ContentHash): Promise<void> {
    if (!isValidHash(h)) return;
    try {
      await unlink(this.pathFor(h).file);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  async *list(prefix?: string): AsyncIterable<ContentHash> {
    let dirs: string[];
    try {
      dirs = (await readdir(this.rootDir)).filter((d) => /^[0-9a-f]{2}$/.test(d)).sort();
    } catch {
      return;
    }
    for (const d of dirs) {
      if (prefix !== undefined && !prefix.startsWith(d) && !d.startsWith(prefix)) continue;
      let files: string[];
      try {
        files = (await readdir(join(this.rootDir, d))).sort();
      } catch {
        continue;
      }
      for (const f of files) {
        const h = d + f;
        if (!isValidHash(h)) continue;
        if (prefix !== undefined && !h.startsWith(prefix)) continue;
        yield h;
      }
    }
  }
}
