import { ed25519 } from '@noble/curves/ed25519';

export interface Keypair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export function generateKeypair(): Keypair {
  const seed = crypto.getRandomValues(new Uint8Array(32));
  return { publicKey: ed25519.getPublicKey(seed), secretKey: seed };
}

export function sign(message: Uint8Array, secretKey: Uint8Array): Uint8Array {
  return ed25519.sign(message, secretKey);
}

export function verify(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean {
  try {
    return ed25519.verify(signature, message, publicKey);
  } catch {
    return false;
  }
}
