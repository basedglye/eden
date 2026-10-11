import type { AgentId } from '@eden/identity';
import type { CapabilityToken } from './capabilities.js';

export interface RegistryEntry {
  id: AgentId;
  /** Capabilities this agent advertises it accepts or offers. */
  capabilities: CapabilityToken[];
  /** Contact endpoints (URIs); an agent may list several. */
  contact: string[];
  /** Unix epoch milliseconds. */
  lastSeen: number;
}

export interface SignedRegistryEntry {
  entry: RegistryEntry;
  /** Signature by `entry.id` over the canonical encoding of `entry`. */
  signature: Uint8Array;
}
