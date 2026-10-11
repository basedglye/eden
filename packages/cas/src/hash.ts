/** Lowercase hex SHA-256 digest of content. */
export type ContentHash = string & { readonly __brand: 'ContentHash' };

export function hashContent(data: Uint8Array): ContentHash {
  // TODO: implement with @noble/hashes/sha256
  throw new Error('not implemented');
}

export function isContentHash(value: string): value is ContentHash {
  // TODO: implement (64 hex chars)
  throw new Error('not implemented');
}
