import type { AgentId } from '@eden-sanctuary/identity';
import { bytesToHex } from '@noble/hashes/utils';

export interface CapabilityToken {
  issuer: AgentId;
  subject: AgentId;
  actions: string[];
  expires: number;
  nonce: string;
  parent?: string;
  signature: string;
}

type SignFn = (typeName: string, obj: object) => string;

const TOKEN_TYPE = 'capability-token';

export function actionCovers(allowed: string, requested: string): boolean {
  if (allowed === requested) return true;
  return requested.startsWith(`${allowed}:`) || requested.startsWith(`${allowed}/`);
}

function sign(unsigned: Omit<CapabilityToken, 'signature'>, signFn: SignFn): CapabilityToken {
  return { ...unsigned, signature: signFn(TOKEN_TYPE, unsigned) };
}

export function issueToken(opts: {
  issuer: AgentId;
  subject: AgentId;
  actions: string[];
  expires: number;
  signFn: SignFn;
}): CapabilityToken {
  const nonce = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  const { issuer, subject, actions, expires } = opts;
  return sign({ issuer, subject, actions: [...actions], expires, nonce }, opts.signFn);
}

export function delegateToken(opts: {
  parent: CapabilityToken;
  subject: AgentId;
  actions: string[];
  expires: number;
  signFn: SignFn;
  parentHash: string;
}): CapabilityToken {
  const { parent } = opts;
  if (opts.expires > parent.expires) throw new Error('delegateToken: expires exceeds parent');
  for (const a of opts.actions) {
    if (!parent.actions.some((p) => actionCovers(p, a))) {
      throw new Error(`delegateToken: action not covered by parent: ${a}`);
    }
  }
  const nonce = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  return sign(
    {
      issuer: parent.subject,
      subject: opts.subject,
      actions: [...opts.actions],
      expires: opts.expires,
      nonce,
      parent: opts.parentHash,
    },
    opts.signFn,
  );
}

type CheckResult = { ok: true } | { ok: false; reason: string };

export function checkToken(opts: {
  token: CapabilityToken;
  action: string;
  now: number;
  verifyFn: (issuer: AgentId, typeName: string, obj: { signature: string }) => boolean;
  revoked?: (nonce: string) => boolean;
  chain?: CapabilityToken[];
}): CheckResult {
  const { token, action, now, verifyFn, revoked } = opts;
  const chain = opts.chain ?? [];
  const links = [...chain, token];

  for (let i = 0; i < links.length; i++) {
    const t = links[i]!;
    if (!verifyFn(t.issuer, TOKEN_TYPE, t)) return { ok: false, reason: 'bad signature' };
    if (t.expires <= now) return { ok: false, reason: 'expired' };
    if (revoked?.(t.nonce)) return { ok: false, reason: 'revoked' };
    if (i > 0) {
      const p = links[i - 1]!;
      if (t.issuer !== p.subject) return { ok: false, reason: 'chain broken: issuer is not parent subject' };
      if (t.expires > p.expires) return { ok: false, reason: 'chain broken: expires exceeds parent' };
      const widened = t.actions.find((a) => !p.actions.some((pa) => actionCovers(pa, a)));
      if (widened !== undefined) return { ok: false, reason: `chain broken: action widened: ${widened}` };
    }
  }

  if (chain.length === 0 && token.parent !== undefined) {
    return { ok: false, reason: 'delegated token requires chain' };
  }
  if (!token.actions.some((a) => actionCovers(a, action))) return { ok: false, reason: 'action not covered' };
  return { ok: true };
}
