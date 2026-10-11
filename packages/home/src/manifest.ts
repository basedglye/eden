import type { AgentId } from '@eden/identity';
import type { ContentHash } from '@eden/cas';

export interface HomeFileEntry {
  /** Path relative to the home root, POSIX separators. */
  path: string;
  hash: ContentHash;
  size: number;
}

export interface WeightsRef {
  name: string;
  hash: ContentHash;
  /** Optional alternate locations (URIs) for large weights; hash remains authoritative. */
  locations?: string[];
}

export interface HomeManifest {
  version: number;
  owner: AgentId;
  /** Hash of the previous manifest, forming a version chain. */
  parent?: ContentHash;
  files: HomeFileEntry[];
  configs: Record<string, string>;
  weights: WeightsRef[];
  /** Unix epoch milliseconds. */
  createdAt: number;
}

export interface SignedHomeManifest {
  manifest: HomeManifest;
  /** Owner's signature over the canonical encoding of `manifest`. */
  signature: Uint8Array;
}
