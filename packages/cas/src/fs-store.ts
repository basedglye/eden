import type { ContentHash } from './hash.js';
import type { IStore } from './store.js';

export class FsStore implements IStore {
  constructor(readonly rootDir: string) {}

  async put(data: Uint8Array): Promise<ContentHash> {
    // TODO: implement
    throw new Error('not implemented');
  }

  async get(hash: ContentHash): Promise<Uint8Array | undefined> {
    // TODO: implement
    throw new Error('not implemented');
  }

  async has(hash: ContentHash): Promise<boolean> {
    // TODO: implement
    throw new Error('not implemented');
  }

  // eslint-disable-next-line require-yield
  async *list(): AsyncIterable<ContentHash> {
    // TODO: implement
    throw new Error('not implemented');
  }
}
