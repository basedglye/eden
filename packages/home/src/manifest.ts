import type { AgentId } from '@eden/identity';
import type { ContentHash } from '@eden/cas';

export type Signature = string; // hex-encoded Ed25519 signature
export type Timestamp = number; // ms since Unix epoch

export interface HomeManifest {
  version: number;
  agentId: AgentId;
  parentHash?: ContentHash;
  files: Record<string, ContentHash>; // relative path -> blob hash
  configs: Record<string, ContentHash>; // config key -> blob hash
  created: Timestamp;
  signature: Signature;
}

export interface ProcessDef {
  name: string;
  entrypoint: string;
  runtime: 'native' | 'wasm' | 'container';
  args: string[];
  env: Record<string, string>;
}
