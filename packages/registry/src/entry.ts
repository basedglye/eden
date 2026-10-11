import type { AgentId } from '@eden-sanctuary/identity';

export type ContactMethod =
  | { kind: 'https'; url: string }
  | { kind: 'libp2p'; multiaddr: string }
  | { kind: 'webrtc'; signalingUrl: string }
  | { kind: 'onion'; address: string }
  | { kind: 'mailbox'; store: string; topic: string };

export interface RegistryEntry {
  agentId: AgentId;
  head?: string;
  capabilities: string[];
  contactMethods: ContactMethod[];
  lastSeen: number;
  seq: number;
  signature: string;
}

export interface Tombstone {
  agentId: AgentId;
  seq: number;
  reason?: string;
  created: number;
  signature: string;
}
