import type { ContentHash, IStore } from '@eden/cas';
import type { Keypair } from '@eden/identity';
import type { SignedHomeManifest } from './manifest.js';

export async function snapshotHome(
  rootDir: string,
  owner: Keypair,
  store: IStore,
  parent?: ContentHash,
): Promise<ContentHash> {
  // TODO: implement; returns hash of the stored signed manifest
  throw new Error('not implemented');
}

export async function loadSnapshot(hash: ContentHash, store: IStore): Promise<SignedHomeManifest> {
  // TODO: implement
  throw new Error('not implemented');
}

export async function restoreSnapshot(
  hash: ContentHash,
  store: IStore,
  targetDir: string,
): Promise<void> {
  // TODO: implement
  throw new Error('not implemented');
}
