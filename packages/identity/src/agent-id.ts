import bs58 from 'bs58';
import type { Keypair } from './keypair.js';

/** Base58-encoded Ed25519 public key. Branded to prevent mixing with arbitrary strings. */
export type AgentId = string & { readonly __brand: 'AgentId' };

export function agentIdFromPublicKey(pk: Uint8Array): AgentId {
  return bs58.encode(pk) as AgentId;
}

export function publicKeyFromAgentId(id: AgentId): Uint8Array {
  const bytes = bs58.decode(id);
  if (bytes.length !== 32) throw new Error('invalid AgentId: expected 32-byte public key');
  return bytes;
}

export function agentIdFromKeypair(kp: Keypair): AgentId {
  return agentIdFromPublicKey(kp.publicKey);
}

export function isAgentId(value: string): value is AgentId {
  try {
    return bs58.decode(value).length === 32;
  } catch {
    return false;
  }
}
