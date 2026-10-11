import type { AgentId } from '@eden-sanctuary/identity';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import { split, combine, type Share } from './shamir.js';

export interface ShareHolderEntry {
  holder: AgentId;
  shareIndex: number;
  shareHash: string;
}

export interface RecoveryPlan {
  agentId: AgentId;
  threshold: number;
  totalShares: number;
  shareHolders: ShareHolderEntry[];
  verificationHash: string;
  created: number;
  signature: string;
}

export function createRecoveryPlan(opts: {
  secret: Uint8Array;
  agentId: AgentId;
  threshold: number;
  holders: AgentId[];
  signFn: (typeName: string, obj: object) => string;
}): { plan: RecoveryPlan; shares: Map<AgentId, Share> } {
  const { secret, agentId, threshold, holders, signFn } = opts;
  if (threshold < 2) throw new Error('recovery: threshold must be >= 2');
  if (holders.length < threshold) throw new Error('recovery: holders must be >= threshold');
  if (new Set(holders).size !== holders.length) throw new Error('recovery: duplicate holders');
  const parts = split(secret, threshold, holders.length);
  const shares = new Map<AgentId, Share>();
  const shareHolders: ShareHolderEntry[] = holders.map((holder, i) => {
    const share = parts[i]!;
    shares.set(holder, share);
    return { holder, shareIndex: share.index, shareHash: bytesToHex(sha256(share.bytes)) };
  });
  const unsigned = {
    agentId,
    threshold,
    totalShares: holders.length,
    shareHolders,
    verificationHash: bytesToHex(sha256(secret)),
    created: Date.now(),
  };
  const signature = signFn('recovery-plan', unsigned);
  return { plan: { ...unsigned, signature }, shares };
}

export function verifyRecoveryPlan(
  plan: RecoveryPlan,
  verifyFn: (typeName: string, obj: { signature: string }) => boolean,
): boolean {
  return verifyFn('recovery-plan', plan);
}

export function recoverSecret(opts: { plan: RecoveryPlan; shares: Share[] }): Uint8Array {
  const { plan, shares } = opts;
  if (shares.length < plan.threshold) {
    throw new Error(`recovery: need ${plan.threshold} shares, got ${shares.length}`);
  }
  const seen = new Set<number>();
  for (const sh of shares) {
    const actual = bytesToHex(sha256(sh.bytes));
    if (actual !== bytesToHex(sh.checksum)) {
      throw new Error(`recovery: checksum mismatch for share ${sh.index}`);
    }
    const entry = plan.shareHolders.find((e) => e.shareIndex === sh.index);
    if (!entry) throw new Error(`recovery: share index ${sh.index} not in plan`);
    if (entry.shareHash !== actual) {
      throw new Error(`recovery: share ${sh.index} hash does not match plan`);
    }
    if (seen.has(sh.index)) throw new Error(`recovery: duplicate share index ${sh.index}`);
    seen.add(sh.index);
  }
  const secret = combine(shares);
  if (bytesToHex(sha256(secret)) !== plan.verificationHash) {
    throw new Error('recovery: reconstructed secret fails verification hash');
  }
  return secret;
}

function bullets(xs?: string[]): string {
  return xs && xs.length ? xs.map((x) => `  - ${x}`).join('\n') : '  - (none recorded)';
}

export function generateInstructions(
  plan: RecoveryPlan,
  ctx: { registries?: string[]; stores?: string[]; latestHead?: string },
): string {
  const lines = [
    `# Recovery instructions for ${plan.agentId}`,
    '',
    `Plan created: ${new Date(plan.created).toISOString()}`,
    `Threshold: ${plan.threshold} of ${plan.totalShares} shares required.`,
    `Verification hash (SHA-256 of the secret): ${plan.verificationHash}`,
    '',
    '## Share holders',
    ...plan.shareHolders.map(
      (e) => `  - share ${e.shareIndex}: ${e.holder} (share hash ${e.shareHash})`,
    ),
    '',
    '## Where to find artifacts',
    'Registries:',
    bullets(ctx.registries),
    'Stores:',
    bullets(ctx.stores),
    `Latest head: ${ctx.latestHead ?? '(none recorded)'}`,
    '',
    '## Steps',
    '1. Verify the plan signature with verifyRecoveryPlan against the agent public key.',
    `2. Ask at least ${plan.threshold} share holders to return their shares.`,
    '3. Call recoverSecret({ plan, shares }); it checks checksums, indices, share hashes and the verification hash.',
    '4. Rebuild the keypair from the recovered secret and confirm it yields the agent ID above.',
    '5. Fetch the latest head from a listed store or registry and resume from it.',
    '6. Rotate the key and redistribute fresh shares, since the old shares are now exposed.',
  ];
  return lines.join('\n');
}
