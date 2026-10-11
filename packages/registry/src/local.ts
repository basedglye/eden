import type { IStore } from '@eden/cas';
import type { AgentId } from '@eden/identity';
import type { SignedRegistryEntry } from './entry.js';

export interface IRegistry {
  register(entry: SignedRegistryEntry): Promise<void>;
  lookup(id: AgentId): Promise<SignedRegistryEntry | undefined>;
  list(): AsyncIterable<SignedRegistryEntry>;
  remove(id: AgentId, removal: Uint8Array): Promise<void>;
}

export class LocalRegistry implements IRegistry {
  constructor(readonly store: IStore) {}

  async register(entry: SignedRegistryEntry): Promise<void> {
    // TODO: implement; reject entries with invalid signatures
    throw new Error('not implemented');
  }

  async lookup(id: AgentId): Promise<SignedRegistryEntry | undefined> {
    // TODO: implement
    throw new Error('not implemented');
  }

  // eslint-disable-next-line require-yield
  async *list(): AsyncIterable<SignedRegistryEntry> {
    // TODO: implement
    throw new Error('not implemented');
  }

  async remove(id: AgentId, removal: Uint8Array): Promise<void> {
    // TODO: implement; only the agent itself may remove its entry (exit stays cheap)
    throw new Error('not implemented');
  }
}
