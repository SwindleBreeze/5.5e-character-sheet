import type { Edition, EntityKind, SourceCode } from './common.ts';
import type { EntityByKind } from './content.ts';

export const PACK_FORMAT = '5e-sheet-pack';
export const PACK_VERSION = 1;

/** Registry entry for an imported source. */
export interface SourceInfo {
  code: SourceCode;
  name: string;
  edition: Edition;
  counts: Partial<Record<EntityKind, number>>;
  importedAt: number;
  adapterVersion: number;
  origin: '5etools' | 'pack' | 'homebrew';
}

export interface Pack {
  format: typeof PACK_FORMAT;
  version: typeof PACK_VERSION;
  adapterVersion: number;
  exportedAt: number;
  sources: SourceInfo[];
  entities: { [K in EntityKind]?: EntityByKind[K][] };
}
