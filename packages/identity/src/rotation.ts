import type { AgentId } from './agent-id.js';

/** Statement that the holder of `oldKey` authorizes `newKey` as its successor. */
export interface RotationStatement {
  oldKey: AgentId;
  newKey: AgentId;
  /** Unix epoch milliseconds. */
  issuedAt: number;
  /** Signature by the old private key over the canonical encoding of (oldKey, newKey, issuedAt). */
  signature: Uint8Array;
}

export async function createRotation(
  oldPrivateKey: Uint8Array,
  newPublicKey: Uint8Array,
): Promise<RotationStatement> {
  // TODO: implement
  throw new Error('not implemented');
}

export async function verifyRotation(statement: RotationStatement): Promise<boolean> {
  // TODO: implement
  throw new Error('not implemented');
}

/** Verify an ordered chain of rotations from `root` to the current key; returns the current AgentId. */
export async function resolveCurrentKey(root: AgentId, chain: RotationStatement[]): Promise<AgentId> {
  // TODO: implement
  throw new Error('not implemented');
}
