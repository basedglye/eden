import type { IStore } from '@eden/cas';
import type { Keypair } from '@eden/identity';
import type { SignedHomeManifest } from './manifest.js';

export async function createBundle(
  rootDir: string,
  owner: Keypair,
  store: IStore,
): Promise<SignedHomeManifest> {
  // TODO: implement
  throw new Error('not implemented');
}

export async function verifyBundle(signed: SignedHomeManifest, store: IStore): Promise<boolean> {
  // TODO: implement (signature + every referenced blob present and hash-valid)
  throw new Error('not implemented');
}

export async function restoreBundle(
  signed: SignedHomeManifest,
  store: IStore,
  targetDir: string,
): Promise<void> {
  // TODO: implement; must refuse unverified bundles
  throw new Error('not implemented');
}
