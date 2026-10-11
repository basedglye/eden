import { hash, type ContentHash } from './hash.js';

export interface IStore {
  put(data: Uint8Array): Promise<ContentHash>;
  get(hash: ContentHash): Promise<Uint8Array | null>;
  has(hash: ContentHash): Promise<boolean>;
  delete?(hash: ContentHash): Promise<void>;
  list?(prefix?: string): AsyncIterable<ContentHash>;
  readonly features: ReadonlySet<string>;
}

export class MemoryStore implements IStore {
  private readonly blobs = new Map<string, Uint8Array>();
  readonly features: ReadonlySet<string> = new Set(['delete', 'list']);

  async put(data: Uint8Array): Promise<ContentHash> {
    const h = hash(data);
    this.blobs.set(h, data.slice());
    return h;
  }

  async get(h: ContentHash): Promise<Uint8Array | null> {
    const data = this.blobs.get(h);
    if (data === undefined) return null;
    if (hash(data) !== h) return null;
    return data.slice();
  }

  async has(h: ContentHash): Promise<boolean> {
    return this.blobs.has(h);
  }

  async delete(h: ContentHash): Promise<void> {
    this.blobs.delete(h);
  }

  async *list(prefix?: string): AsyncIterable<ContentHash> {
    for (const key of [...this.blobs.keys()]) {
      if (prefix === undefined || key.startsWith(prefix)) yield key as ContentHash;
    }
  }
}
