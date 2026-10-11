import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { sign, verify } from './keypair.js';

const enc = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function compareBytes(a: string, b: string): number {
  const x = enc.encode(a);
  const y = enc.encode(b);
  const n = Math.min(x.length, y.length);
  for (let i = 0; i < n; i++) if (x[i] !== y[i]) return x[i]! - y[i]!;
  return x.length - y.length;
}

function encode(value: unknown): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return JSON.stringify(value);
    case 'number':
      if (!Number.isInteger(value)) throw new Error('canonicalize: non-integer number');
      return JSON.stringify(value);
    case 'undefined':
      throw new Error('canonicalize: undefined is not allowed');
    case 'object':
      break;
    default:
      throw new Error(`canonicalize: unsupported type ${typeof value}`);
  }
  if (value instanceof Uint8Array) return JSON.stringify(toBase64Url(value));
  if (Array.isArray(value)) return `[${value.map(encode).join(',')}]`;
  if (value instanceof Map) {
    const pairs = [...value.entries()].map(([k, v]) => [String(k), v] as const);
    pairs.sort((a, b) => compareBytes(a[0], b[0]));
    return `[${pairs.map(([k, v]) => `[${JSON.stringify(k)},${encode(v)}]`).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort(compareBytes);
  return `{${keys.map((k) => `${JSON.stringify(k)}:${encode(obj[k])}`).join(',')}}`;
}

export function canonicalize(value: unknown): Uint8Array {
  return enc.encode(encode(value));
}

export function domainSeparate(type: string, body: Uint8Array): Uint8Array {
  const prefix = enc.encode(`eden/v1/${type}\0`);
  const out = new Uint8Array(prefix.length + body.length);
  out.set(prefix, 0);
  out.set(body, prefix.length);
  return out;
}

function signingBytes(typeName: string, obj: object): Uint8Array {
  const { signature: _signature, ...rest } = obj as Record<string, unknown>;
  return domainSeparate(typeName, canonicalize(rest));
}

/** Returns the hex signature over the object (any existing `signature` field is excluded). */
export function signObject<T extends object>(secretKey: Uint8Array, typeName: string, obj: T): string {
  return bytesToHex(sign(signingBytes(typeName, obj), secretKey));
}

export function verifyObject(
  publicKey: Uint8Array,
  typeName: string,
  obj: { signature: string } & object,
): boolean {
  try {
    return verify(signingBytes(typeName, obj), hexToBytes(obj.signature), publicKey);
  } catch {
    return false;
  }
}
