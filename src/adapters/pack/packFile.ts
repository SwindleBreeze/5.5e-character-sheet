// Content packs (plan §6.3): every imported entity plus the source registry, as gzipped JSON.
// A pack is how a group shares content with phones: made once on a desktop from 5etools data,
// then opened from Files, AirDrop or a chat attachment. Packs never go in the repo.

import {
  PACK_FORMAT,
  PACK_VERSION,
  type EntitiesByKind,
  type Pack,
  type SourceInfo,
} from '../../schema/index.ts';

/** Bytes → stream → transform → bytes, without relying on Blob.stream (missing in some envs). */
async function transform(
  bytes: Uint8Array,
  stream: ReadableWritablePair<Uint8Array, BufferSource>,
): Promise<Uint8Array> {
  const source = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(new Uint8Array(bytes));
      controller.close();
    },
  });
  const out = await new Response(source.pipeThrough(stream)).arrayBuffer();
  return new Uint8Array(out);
}

export function gzip(bytes: Uint8Array): Promise<Uint8Array> {
  return transform(bytes, new CompressionStream('gzip'));
}

export function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  return transform(bytes, new DecompressionStream('gzip'));
}

export function isGzip(bytes: Uint8Array): boolean {
  return bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

export class PackError extends Error {}

export function buildPack(
  entities: EntitiesByKind,
  sources: SourceInfo[],
  adapterVersion: number,
  now: number,
): Pack {
  return {
    format: PACK_FORMAT,
    version: PACK_VERSION,
    adapterVersion,
    exportedAt: now,
    sources,
    entities,
  };
}

export async function encodePack(pack: Pack): Promise<Uint8Array> {
  return gzip(new TextEncoder().encode(JSON.stringify(pack)));
}

/**
 * Read a pack file (gzipped or plain JSON) and check its shape. `skippedKinds` lists entity
 * kinds from a newer app that this one cannot use.
 */
export async function readPack(
  bytes: Uint8Array,
): Promise<{ pack: Pack; skippedKinds: Record<string, number> }> {
  let text: string;
  try {
    text = new TextDecoder().decode(isGzip(bytes) ? await gunzip(bytes) : bytes);
  } catch {
    throw new PackError('This file could not be unpacked. Is it a content pack?');
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new PackError('This file is not a content pack (it is not valid JSON).');
  }
  const { validatePack } = await import('./packSchema.ts');
  return validatePack(json);
}

export async function decodePack(bytes: Uint8Array): Promise<Pack> {
  return (await readPack(bytes)).pack;
}

export function packFileName(now: number): string {
  const date = new Date(now).toISOString().slice(0, 10);
  return `content-${date}.pack.json.gz`;
}
