// Read/write access to imported content. Writes replace by source so errata and removed
// entities apply on re-import (plan §6.2).

import type { Table } from 'dexie';
import { ENTITY_KINDS, refKey } from '../schema/index.ts';
import type {
  ContentEntity,
  EntityByKind,
  EntityKind,
  Id,
  Ref,
  RefKey,
  SourceCode,
  SourceInfo,
} from '../schema/index.ts';
import { TABLE_BY_KIND, getDb, type AppDb } from './db.ts';

export type EntitiesByKind = { [K in EntityKind]?: EntityByKind[K][] };

function table<K extends EntityKind>(db: AppDb, kind: K): Table<EntityByKind[K], Id> {
  return db[TABLE_BY_KIND[kind]] as unknown as Table<EntityByKind[K], Id>;
}

function allContentTables(db: AppDb): Table[] {
  return [...ENTITY_KINDS.map((k) => table(db, k) as unknown as Table), db.sources];
}

export function createContentRepo(db: AppDb = getDb()) {
  return {
    async get<K extends EntityKind>(kind: K, id: Id): Promise<EntityByKind[K] | undefined> {
      return table(db, kind).get(id);
    },

    /** Resolve many refs at once. Missing entities are simply absent from the result. */
    async getMany(refs: Ref[]): Promise<Map<RefKey, ContentEntity>> {
      const result = new Map<RefKey, ContentEntity>();
      const idsByKind = new Map<EntityKind, Id[]>();
      for (const ref of refs) {
        const ids = idsByKind.get(ref.kind) ?? [];
        ids.push(ref.id);
        idsByKind.set(ref.kind, ids);
      }
      for (const [kind, ids] of idsByKind) {
        const rows = await table(db, kind).bulkGet(ids);
        for (const row of rows) {
          if (row) result.set(refKey({ kind, id: row.id }), row);
        }
      }
      return result;
    },

    async listByKind<K extends EntityKind>(kind: K): Promise<EntityByKind[K][]> {
      return table(db, kind).toArray();
    },

    async countByKind(kind: EntityKind): Promise<number> {
      return table(db, kind).count();
    },

    /**
     * Write an import. For every source listed in `sources`, entities of that source that are
     * not in `entities` are deleted and the rest are upserted. Other sources are untouched.
     */
    async replaceSources(sources: SourceInfo[], entities: EntitiesByKind): Promise<void> {
      const codes = sources.map((s) => s.code);
      await db.transaction('rw', allContentTables(db), async () => {
        for (const kind of ENTITY_KINDS) {
          const t = table(db, kind) as unknown as Table<ContentEntity, Id>;
          const incoming = (entities[kind] ?? []) as ContentEntity[];
          const keep = new Set(incoming.map((e) => e.id));
          const stale = await t
            .where('source')
            .anyOf(codes)
            .filter((e) => !keep.has(e.id))
            .primaryKeys();
          if (stale.length) await t.bulkDelete(stale);
          if (incoming.length) await t.bulkPut(incoming);
        }
        await db.sources.bulkPut(sources);
      });
    },

    async deleteSource(code: SourceCode): Promise<void> {
      await db.transaction('rw', allContentTables(db), async () => {
        for (const kind of ENTITY_KINDS) {
          await table(db, kind).where('source').equals(code).delete();
        }
        await db.sources.delete(code);
      });
    },

    async listSources(): Promise<SourceInfo[]> {
      return db.sources.orderBy('code').toArray();
    },
  };
}

export type ContentRepo = ReturnType<typeof createContentRepo>;
