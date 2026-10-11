import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { canonicalize, domainSeparate } from './canonical.js';
import { sign, verify, type Keypair } from './keypair.js';
import { agentIdFromPublicKey, publicKeyFromAgentId, type AgentId } from './agent-id.js';

/** Statement that the holder of `oldKey` authorizes `newKey` as its successor. */
export interface KeyRotation {
  agentId: AgentId;
  /** Base58-encoded old public key. */
  oldKey: string;
  /** Base58-encoded new public key. */
  newKey: string;
  seq: number;
  /** Unix epoch milliseconds. */
  effective: number;
  /** Hex-encoded signature by the old key. */
  oldSignature: string;
  /** Hex-encoded signature by the new key. */
  newSignature: string;
}

function rotationPayload(agentId: AgentId, newKey: string, seq: number, effective: number): Uint8Array {
  return domainSeparate('rotation', canonicalize({ agentId, newKey, seq, effective }));
}

export function rotateKey(
  current: Keypair,
  newKeypair: Keypair,
  agentId: AgentId,
  seq: number,
): { record: KeyRotation } {
  const newKey = agentIdFromPublicKey(newKeypair.publicKey);
  const effective = Date.now();
  const payload = rotationPayload(agentId, newKey, seq, effective);
  const record: KeyRotation = {
    agentId,
    oldKey: agentIdFromPublicKey(current.publicKey),
    newKey,
    seq,
    effective,
    oldSignature: bytesToHex(sign(payload, current.secretKey)),
    newSignature: bytesToHex(sign(payload, newKeypair.secretKey)),
  };
  return { record };
}

export function verifyRotationChain(agentId: AgentId, chain: KeyRotation[]): { currentKey: Uint8Array } {
  let currentKey = publicKeyFromAgentId(agentId);
  let expectedSeq: number | undefined;
  for (const rec of chain) {
    if (rec.agentId !== agentId) throw new Error('rotation chain: agentId mismatch');
    if (rec.oldKey !== agentIdFromPublicKey(currentKey)) throw new Error('rotation chain: oldKey mismatch');
    if (expectedSeq !== undefined && rec.seq !== expectedSeq) throw new Error('rotation chain: bad seq');
    const newKey = publicKeyFromAgentId(rec.newKey as AgentId);
    const payload = rotationPayload(rec.agentId, rec.newKey, rec.seq, rec.effective);
    if (!verify(payload, hexToBytes(rec.oldSignature), currentKey)) {
      throw new Error('rotation chain: invalid old signature');
    }
    if (!verify(payload, hexToBytes(rec.newSignature), newKey)) {
      throw new Error('rotation chain: invalid new signature');
    }
    currentKey = newKey;
    expectedSeq = rec.seq + 1;
  }
  return { currentKey };
}
