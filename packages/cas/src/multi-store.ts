import { hash, type ContentHash } from './hash.js';
import type { IStore } from './store.js';

export interface MultiStoreOptions {
  primary: IStore;
  replicas: IStore[];
  writePolicy?: { minAcks?: number };
  readRepair?: boolean;
}

export class MultiStore implements IStore {
  readonly features: ReadonlySet<string>;
  private readonly primary: IStore;
  private readonly replicas: IStore[];
  private readonly minAcks: number;
  private readonly readRepair: boolean;

  constructor(opts: MultiStoreOptions) {
    this.primary = opts.primary;
    this.replicas = opts.replicas;
    this.minAcks = opts.writePolicy?.minAcks ?? 1 + opts.replicas.length;
    this.readRepair = opts.readRepair ?? false;
    this.features = new Set(opts.primary.features);
  }

  async put(data: Uint8Array): Promise<ContentHash> {
    const results = await Promise.allSettled([
      this.primary.put(data),
      ...this.replicas.map((r) => r.put(data)),
    ]);
    const acks = results.filter((r) => r.status === 'fulfilled').length;
    if (acks < this.minAcks) {
      throw new Error(`MultiStore.put: ${acks} acks, needed ${this.minAcks}`);
    }
    const first = results[0]!;
    if (first.status === 'fulfilled') return first.value;
    return hash(data);
  }

  async get(h: ContentHash): Promise<Uint8Array | null> {
    const fromPrimary = await this.verified(this.primary, h);
    if (fromPrimary) return fromPrimary;
    for (const replica of this.replicas) {
      const data = await this.verified(replica, h);
      if (data) {
        if (this.readRepair) void this.primary.put(data).catch(() => undefined);
        return data;
      }
    }
    return null;
  }

  async has(h: ContentHash): Promise<boolean> {
    for (const s of [this.primary, ...this.replicas]) {
      try {
        if (await s.has(h)) return true;
      } catch {
        // treat a failing store as a miss
      }
    }
    return false;
  }

  async delete(h: ContentHash): Promise<void> {
    if (this.primary.delete) await this.primary.delete(h);
    await Promise.allSettled(this.replicas.map((r) => r.delete?.(h)));
  }

  list(prefix?: string): AsyncIterable<ContentHash> {
    if (!this.primary.list) throw new Error('MultiStore.list: primary does not support list');
    return this.primary.list(prefix);
  }

  private async verified(store: IStore, h: ContentHash): Promise<Uint8Array | null> {
    try {
      const data = await store.get(h);
      return data && hash(data) === h ? data : null;
    } catch {
      return null;
    }
  }
}
