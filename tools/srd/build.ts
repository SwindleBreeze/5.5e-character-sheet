// Builds the SRD pack the app ships (plan 9.2) from a local clone of the Foundry VTT dnd5e system
// (never committed):
//
//   node tools/srd/build.ts /path/to/dnd5e [--check /path/to/5etools-data]
//
// Converts the SRD 5.2 compendium to 5etools records, imports them with the app's own importer,
// files them under the `SRD52` source and writes `public/srd/srd52.pack.json.gz`. Prints the
// pack's checksum for `ALLOWED_CONTENT` (scripts/content-guard-core.mjs) and the entries the
// compendium leaves unmarked, to check against the SRD.
//
// `--check` (developers only) compares the ids with those of a local data folder of the 2024
// books, listing SRD entries with no twin there: names to add to `RENAMES`.

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { importHomebrew } from '../../src/adapters/fivetools/homebrew.ts';
import { buildPack, encodePack } from '../../src/adapters/pack/packFile.ts';
import { ADAPTER_VERSION } from '../../src/adapters/version.ts';
import type { ContentEntity, EntitiesByKind, SourceInfo } from '../../src/schema/index.ts';
import { SRD_SOURCE } from '../../src/content/srd.ts';
import { convertClasses } from './classes.ts';
import { convertCreatures } from './creatures.ts';
import { Context, TWIN } from './context.ts';
import { convertFeats } from './feats.ts';
import { readJournal, readPack, untagged, type Doc } from './foundry.ts';
import { convertItems } from './items.ts';
import { convertBackgrounds, convertSpecies } from './origins.ts';
import { convertRules } from './rules.ts';
import { convertSpells, spellLists } from './spells.ts';

const root = process.argv[2];
if (!root) {
  console.error('Usage: node tools/srd/build.ts /path/to/dnd5e [--check /path/to/data]');
  process.exit(1);
}

const PACKS = ['classes24', 'spells24', 'equipment24', 'feats24', 'origins24', 'actors24'] as const;
const docs = Object.fromEntries(PACKS.map((p) => [p, readPack(root, p)])) as Record<
  (typeof PACKS)[number],
  (Doc & { _path: string })[]
>;

const ctx = new Context();
for (const p of PACKS) ctx.add(p, docs[p]);
const glossary = readJournal(root, 'content24', 'appendices/rules-glossary.yml');
for (const page of glossary.pages as Doc[]) {
  ctx.pages.set(String(page._id), {
    name: String(page.name),
    type: String(page.system?.type ?? ''),
  });
}
const spellChapter = readJournal(root, 'content24', 'chapter-7/spells.yml');
const journal = (file: string) => readJournal(root, 'content24', file).pages as Doc[];
const pageHtml = (list: Doc[], name?: string) =>
  list
    .filter((p) => !name || p.name === name)
    .map((p) => String(p.text?.content ?? ''))
    .join('');
const allPages = new Map(
  ['appendices/appendix-d-rule-references.yml', 'chapter-6/equipment.yml'].flatMap((f) =>
    journal(f).map((p) => [String(p._id), p] as const),
  ),
);

const records = {
  spell: convertSpells(ctx, docs.spells24, spellLists(spellChapter.pages as Doc[])),
  ...convertItems(ctx, docs.equipment24),
  ...convertClasses(ctx, docs.classes24),
  monster: convertCreatures(ctx, docs.actors24),
  race: convertSpecies(ctx, docs.origins24),
  background: convertBackgrounds(ctx, docs.origins24),
  feat: convertFeats(ctx, [...docs.feats24, ...docs.classes24]),
  ...convertRules(ctx, glossary.pages as Doc[], allPages, {
    creation: pageHtml(journal('chapter-2/character-creation.yml')),
    tests: pageHtml(journal('chapter-1/d20-tests.yml')),
    properties: pageHtml(journal('chapter-6/equipment.yml'), 'Properties'),
    mastery: String(allPages.get('7MN2Hp5KnjtddH3m')?.text?.content ?? ''),
  }),
};

const brew = {
  _meta: {
    sources: [TWIN, 'XDMG', 'XMM'].map((json) => ({ json, full: 'System Reference Document 5.2' })),
    edition: 'one',
  },
  ...records,
};

const result = await importHomebrew([{ name: 'srd52.json', text: JSON.stringify(brew) }], {
  now: 0,
});
for (const w of result.report.warnings.slice(0, 40)) console.warn('warn', w.code, w.message);

// The SRD's own names for entries filed under a twin's name.
const srdNames = new Map<string, string>();
for (const list of Object.values(records))
  for (const r of list as Doc[]) if (r.srdName) srdNames.set(String(r.name), String(r.srdName));
// Magic variants keep the 5etools record shape: their names live on `inherits`.

const entities = Object.fromEntries(
  Object.entries(result.entities).map(([kind, list]) => [
    kind,
    (list as ContentEntity[]).map((e) => ({
      ...e,
      source: SRD_SOURCE,
      name: srdNames.get(e.name) ?? e.name,
    })),
  ]),
) as EntitiesByKind;

const counts = Object.fromEntries(
  Object.entries(entities).map(([k, v]) => [k, (v as unknown[]).length]),
) as SourceInfo['counts'];
const source: SourceInfo = {
  code: SRD_SOURCE,
  name: 'System Reference Document 5.2',
  edition: '2024',
  group: 'core',
  counts,
  importedAt: 0,
  adapterVersion: ADAPTER_VERSION,
  origin: 'pack',
};

const pack = buildPack(entities, [source], ADAPTER_VERSION, 0);
const bytes = await encodePack(pack);
mkdirSync('public/srd', { recursive: true });
writeFileSync('public/srd/srd52.pack.json.gz', bytes);
console.log('counts', JSON.stringify(counts));
console.log('sha256', createHash('sha256').update(bytes).digest('hex'));
// Of the creatures, only the Beasts are converted.
const unmarked = PACKS.flatMap((p) =>
  untagged(docs[p])
    .filter((path) => p !== 'actors24' || path.startsWith('beast/'))
    .map((path) => `${p}/${path}`),
);
if (unmarked.length) console.log(`unmarked (${unmarked.length}):\n  ${unmarked.join('\n  ')}`);
