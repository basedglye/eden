import type { AgentId } from '@eden/identity';

export type CapabilityKind = 'read' | 'write' | 'admin' | 'custom';

export interface CapabilityToken {
  kind: CapabilityKind;
  /** Required when kind === 'custom'. */
  name?: string;
  issuer: AgentId;
  subject: AgentId;
  /** Resource scope, e.g. a home manifest hash or '*'. */
  scope: string;
  /** Unix epoch milliseconds; absent means no expiry (revocable by issuer). */
  expiresAt?: number;
  signature: Uint8Array;
}

export async function issueCapability(
  issuerPrivateKey: Uint8Array,
  token: Omit<CapabilityToken, 'signature'>,
): Promise<CapabilityToken> {
  // TODO: implement
  throw new Error('not implemented');
}

export async function verifyCapability(token: CapabilityToken, now?: number): Promise<boolean> {
  // TODO: implement
  throw new Error('not implemented');
}
