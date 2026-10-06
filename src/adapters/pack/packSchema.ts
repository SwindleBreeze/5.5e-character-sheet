// Pack validation with zod, loaded only when a pack is opened. It checks the envelope, the
// source registry and every entity's base fields; kind-specific fields are trusted, since
// packs are made by this app. Entity kinds this version does not know (from a newer app) are
// dropped and counted, not refused.

import { z } from 'zod';
import { ENTITY_KINDS, PACK_FORMAT, PACK_VERSION, type Pack } from '../../schema/index.ts';
import { PackError } from './packFile.ts';

const edition = z.enum(['2014', '2024', 'unknown']);

const sourceInfo = z.looseObject({
  code: z.string().min(1),
  name: z.string(),
  edition,
  group: z.enum(['core', 'supplement', 'adventure', 'other']).optional(),
  published: z.string().optional(),
  counts: z.record(z.string(), z.number()),
  importedAt: z.number(),
  adapterVersion: z.number(),
  origin: z.enum(['5etools', 'pack', 'homebrew']),
});

function entity(kind: string) {
  return z.looseObject({
    id: z.string().min(1),
    kind: z.literal(kind),
    name: z.string(),
    source: z.string().min(1),
    edition,
    entries: z.array(z.unknown()),
    effects: z.array(z.looseObject({ type: z.string() })),
    origin: z.looseObject({
      adapter: z.string(),
      adapterVersion: z.number(),
      importedAt: z.number(),
    }),
  });
}

const packSchema = z.object({
  format: z.literal(PACK_FORMAT),
  version: z.number().int().min(1).max(PACK_VERSION),
  adapterVersion: z.number(),
  exportedAt: z.number(),
  sources: z.array(sourceInfo),
  entities: z.object(
    Object.fromEntries(ENTITY_KINDS.map((k) => [k, z.array(entity(k)).optional()])),
  ),
});

export interface ValidatedPack {
  pack: Pack;
  /** Entity kinds this version of the app does not know, with their entry counts. */
  skippedKinds: Record<string, number>;
}

export function validatePack(json: unknown): ValidatedPack {
  const head = typeof json === 'object' && json !== null ? (json as Record<string, unknown>) : {};
  if (head.format !== PACK_FORMAT) throw new PackError('This file is not a content pack.');
  if (typeof head.version === 'number' && head.version > PACK_VERSION) {
    throw new PackError('This pack was made by a newer version of the app. Update the app first.');
  }
  const parsed = packSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new PackError(
      `This pack is damaged (${issue?.path.join('.') || 'root'}: ${issue?.message}).`,
    );
  }
  const known = new Set<string>(ENTITY_KINDS);
  const skippedKinds: Record<string, number> = {};
  const entities = (head.entities ?? {}) as Record<string, unknown>;
  for (const [kind, list] of Object.entries(entities)) {
    if (!known.has(kind)) skippedKinds[kind] = Array.isArray(list) ? list.length : 0;
  }
  return { pack: parsed.data as unknown as Pack, skippedKinds };
}
