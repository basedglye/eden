import { sha256 } from '@noble/hashes/sha256';

export interface Share {
  index: number;
  bytes: Uint8Array;
  checksum: Uint8Array;
}

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);

// Generator 3 is primitive for 0x11b (2 is not), so exp[i] = exp[i-1] * 3.
(function buildTables() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    let x2 = x << 1;
    if (x2 & 0x100) x2 ^= 0x11b;
    x = x2 ^ x;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]!;
})();

function mul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[(LOG[a]! + LOG[b]!) % 255]!;
}

function div(a: number, b: number): number {
  if (b === 0) throw new Error('shamir: division by zero in GF(256)');
  if (a === 0) return 0;
  return EXP[(LOG[a]! - LOG[b]! + 255) % 255]!;
}

export function split(secret: Uint8Array, k: number, n: number): Share[] {
  if (!Number.isInteger(k) || !Number.isInteger(n) || k < 2 || k > n || n > 255) {
    throw new Error('shamir: require 2 <= k <= n <= 255');
  }
  if (secret.length === 0) throw new Error('shamir: secret must be non-empty');
  const out: Uint8Array[] = [];
  for (let s = 0; s < n; s++) out.push(new Uint8Array(secret.length));
  const coeffs = new Uint8Array(k);
  for (let pos = 0; pos < secret.length; pos++) {
    crypto.getRandomValues(coeffs);
    coeffs[0] = secret[pos]!;
    for (let s = 0; s < n; s++) {
      const x = s + 1;
      let y = 0;
      for (let c = k - 1; c >= 0; c--) y = mul(y, x) ^ coeffs[c]!;
      out[s]![pos] = y;
    }
  }
  coeffs.fill(0);
  return out.map((bytes, i) => ({ index: i + 1, bytes, checksum: sha256(bytes) }));
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i]! ^ b[i]!;
  return d === 0;
}

export function combine(shares: Share[]): Uint8Array {
  if (shares.length < 2) throw new Error('shamir: need at least 2 shares');
  const len = shares[0]!.bytes.length;
  const seen = new Set<number>();
  for (const sh of shares) {
    if (!Number.isInteger(sh.index) || sh.index < 1 || sh.index > 255) {
      throw new Error(`shamir: invalid share index ${sh.index}`);
    }
    if (seen.has(sh.index)) throw new Error(`shamir: duplicate share index ${sh.index}`);
    seen.add(sh.index);
    if (sh.bytes.length !== len) throw new Error('shamir: share length mismatch');
    if (!sameBytes(sha256(sh.bytes), sh.checksum)) {
      throw new Error(`shamir: checksum failed for share ${sh.index}`);
    }
  }
  const basis = shares.map((si, i) => {
    let b = 1;
    for (let j = 0; j < shares.length; j++) {
      if (j === i) continue;
      const xj = shares[j]!.index;
      b = mul(b, div(xj, xj ^ si.index));
    }
    return b;
  });
  const secret = new Uint8Array(len);
  for (let pos = 0; pos < len; pos++) {
    let acc = 0;
    for (let i = 0; i < shares.length; i++) acc ^= mul(shares[i]!.bytes[pos]!, basis[i]!);
    secret[pos] = acc;
  }
  return secret;
}
