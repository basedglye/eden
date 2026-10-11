import type { IStore, ContentHash } from '@eden-sanctuary/cas';
import type { AgentId } from '@eden-sanctuary/identity';
import { canonicalize, verifyObject, publicKeyFromAgentId } from '@eden-sanctuary/identity';
import type { RegistryEntry, Tombstone } from './entry.js';

export interface IRegistry {
  publish(entry: RegistryEntry): Promise<void>;
  resolve(id: AgentId): Promise<RegistryEntry | null>;
  search(q: { capability?: string; limit?: number }): Promise<RegistryEntry[]>;
  withdraw(id: AgentId, tombstone: Tombstone): Promise<void>;
}

interface IndexRow {
  entryHash: ContentHash;
  seq: number;
  tombstoned: boolean;
}

const ENTRY_TYPE = 'registry-entry';
const TOMBSTONE_TYPE = 'registry-tombstone';

function verifies(id: AgentId, typeName: string, obj: { signature: string } & object): boolean {
  try {
    return verifyObject(publicKeyFromAgentId(id), typeName, obj);
  } catch {
    return false;
  }
}

function isTombstone(v: Record<string, unknown>): boolean {
  return !('capabilities' in v) && typeof v.created === 'number';
}

export class LocalRegistry implements IRegistry {
  private index = new Map<string, IndexRow>();

  constructor(readonly store: IStore) {}

  async publish(entry: RegistryEntry): Promise<void> {
    if (!verifies(entry.agentId, ENTRY_TYPE, entry)) throw new Error('publish: invalid signature');
    const existing = this.index.get(entry.agentId);
    if (existing?.tombstoned) throw new Error('publish: agent is tombstoned');
    if (existing && entry.seq <= existing.seq) throw new Error('publish: seq must exceed existing seq');
    const entryHash = await this.store.put(canonicalize(entry));
    this.index.set(entry.agentId, { entryHash, seq: entry.seq, tombstoned: false });
  }

  async resolve(id: AgentId): Promise<RegistryEntry | null> {
    const row = this.index.get(id);
    if (!row || row.tombstoned) return null;
    return this.load(row.entryHash);
  }

  async search(q: { capability?: string; limit?: number }): Promise<RegistryEntry[]> {
    const out: RegistryEntry[] = [];
    const limit = q.limit ?? Infinity;
    for (const row of this.index.values()) {
      if (out.length >= limit) break;
      if (row.tombstoned) continue;
      const entry = await this.load(row.entryHash);
      if (!entry) continue;
      if (q.capability !== undefined && !entry.capabilities.includes(q.capability)) continue;
      out.push(entry);
    }
    return out;
  }

  async withdraw(id: AgentId, tombstone: Tombstone): Promise<void> {
    if (tombstone.agentId !== id) throw new Error('withdraw: tombstone agentId mismatch');
    if (!verifies(id, TOMBSTONE_TYPE, tombstone)) throw new Error('withdraw: invalid signature');
    const existing = this.index.get(id);
    if (existing && tombstone.seq <= existing.seq) throw new Error('withdraw: seq must exceed existing seq');
    const entryHash = await this.store.put(canonicalize(tombstone));
    this.index.set(id, { entryHash, seq: tombstone.seq, tombstoned: true });
  }

  async rebuild(): Promise<void> {
    if (!this.store.list) return;
    const next = new Map<string, IndexRow>();
    for await (const h of this.store.list()) {
      const bytes = await this.store.get(h);
      if (!bytes) continue;
      let v: Record<string, unknown>;
      try {
        v = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
      } catch {
        continue;
      }
      if (typeof v !== 'object' || v === null || typeof v.agentId !== 'string' || typeof v.seq !== 'number') continue;
      const tomb = isTombstone(v);
      const ok = verifies(v.agentId as AgentId, tomb ? TOMBSTONE_TYPE : ENTRY_TYPE, v as { signature: string });
      if (!ok) continue;
      const cur = next.get(v.agentId);
      if (cur && cur.seq >= v.seq) continue;
      next.set(v.agentId, { entryHash: h, seq: v.seq, tombstoned: tomb });
    }
    this.index = next;
  }

  private async load(h: ContentHash): Promise<RegistryEntry | null> {
    const bytes = await this.store.get(h);
    if (!bytes) return null;
    return JSON.parse(new TextDecoder().decode(bytes)) as RegistryEntry;
  }
}
