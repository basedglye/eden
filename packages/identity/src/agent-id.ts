/** Base58-encoded Ed25519 public key. Branded to prevent mixing with arbitrary strings. */
export type AgentId = string & { readonly __brand: 'AgentId' };

export function agentIdFromPublicKey(publicKey: Uint8Array): AgentId {
  // TODO: implement with bs58.encode
  throw new Error('not implemented');
}

export function publicKeyFromAgentId(id: AgentId): Uint8Array {
  // TODO: implement with bs58.decode; validate 32-byte length
  throw new Error('not implemented');
}

export function isAgentId(value: string): value is AgentId {
  // TODO: implement
  throw new Error('not implemented');
}
