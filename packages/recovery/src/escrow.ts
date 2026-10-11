import type { AgentId } from '@eden/identity';
import type { Share } from './shamir.js';

export interface EscrowPolicy {
  owner: AgentId;
  threshold: number;
  peers: AgentId[];
}

/** A share sealed to one peer; only that peer can open it. */
export interface EscrowedShare {
  peer: AgentId;
  sealed: Uint8Array;
}

export async function createEscrow(
  secret: Uint8Array,
  policy: EscrowPolicy,
): Promise<EscrowedShare[]> {
  // TODO: implement; split then seal each share to its peer
  throw new Error('not implemented');
}

export async function openShare(
  escrowed: EscrowedShare,
  peerPrivateKey: Uint8Array,
): Promise<Share> {
  // TODO: implement
  throw new Error('not implemented');
}

export async function recoverSecret(shares: Share[], policy: EscrowPolicy): Promise<Uint8Array> {
  // TODO: implement; fail if fewer than policy.threshold shares
  throw new Error('not implemented');
}
