export interface Share {
  /** Share index, 1..255. */
  index: number;
  data: Uint8Array;
}

export function split(secret: Uint8Array, threshold: number, shares: number): Share[] {
  // TODO: implement over GF(256); require 2 <= threshold <= shares <= 255
  throw new Error('not implemented');
}

export function combine(shares: Share[]): Uint8Array {
  // TODO: implement
  throw new Error('not implemented');
}
