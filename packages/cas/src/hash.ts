import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

/** Lowercase hex SHA-256 digest of content. */
export type ContentHash = string & { readonly __brand: 'ContentHash' };

export function hash(data: Uint8Array): ContentHash {
  return bytesToHex(sha256(data)) as ContentHash;
}

export function hashString(s: string): ContentHash {
  return hash(new TextEncoder().encode(s));
}

export function isValidHash(s: string): s is ContentHash {
  return /^[0-9a-f]{64}$/.test(s);
}
