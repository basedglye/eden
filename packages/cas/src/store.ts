import type { ContentHash } from './hash.js';

export interface IStore {
  /** Store content; returns its hash. Idempotent. */
  put(data: Uint8Array): Promise<ContentHash>;
  /** Fetch content by hash; resolves undefined if absent. Implementations must verify the hash. */
  get(hash: ContentHash): Promise<Uint8Array | undefined>;
  has(hash: ContentHash): Promise<boolean>;
  list(): AsyncIterable<ContentHash>;
}
