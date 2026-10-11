export interface Keypair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export async function generateKeypair(): Promise<Keypair> {
  // TODO: implement with @noble/ed25519 (etc.randomBytes + getPublicKeyAsync)
  throw new Error('not implemented');
}

export async function sign(message: Uint8Array, privateKey: Uint8Array): Promise<Uint8Array> {
  // TODO: implement
  throw new Error('not implemented');
}

export async function verify(
  message: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array,
): Promise<boolean> {
  // TODO: implement
  throw new Error('not implemented');
}
