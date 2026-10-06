# 5.5e Character Sheet PWA: Plan (phases 1–2 in detail, 3–8 in outline)

## Context

This is a **private**, offline-first character builder and sheet for D&D 2024 rules, made for one group of friends. It aims at D&D Beyond / Fifth Edition Character Sheet feature parity with a simpler UI.

The repo and the hosted build hold no book content. Content comes from 5etools data, or a pack made from it, imported on each user's device. Three things keep a later public release possible:

- the no-content rule
- a CI guard that enforces it
- a storage-agnostic repo layer

The public-release work itself (bundled SRD) is deferred to phase 8.

The project folder holds only `5etools-src-2.36.1/` today. No app code exists yet. I checked the local 5etools 2.36.1 data before writing this plan, and §1 lists where it changes assumptions in the brief.

### Decisions so far

| Topic               | Decision                                                                                                                                                                                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Audience            | Private app for one group. Public-release features move to phase 8.                                                                                                                                                                                              |
| Classes & sources   | Every class and every source in the 5etools data can be imported. Players switch sources on and off, globally and per character (§6.7).                                                                                                                          |
| 2014 vs 2024        | Phases 1–5 are **2024 only**: 2014 entities (including 2014 subclasses re-homed onto 2024 classes) are hidden. The "Show 2014" toggle comes in phase 8.                                                                                                          |
| SRD 5.2.1           | Bundled in **phase 8**, from a CC-BY structured conversion checked against the official PDF. Never from 5etools.                                                                                                                                                 |
| 5etools folder      | Stays in the project folder and is gitignored.                                                                                                                                                                                                                   |
| Devices             | Full iOS parity. Storage strategy is in §6.9.                                                                                                                                                                                                                    |
| Hosting             | GitHub Pages, public repo `5.5e-character-sheet`, Vite `base: '/5.5e-character-sheet/'`, deployed by GitHub Actions.                                                                                                                                             |
| Content on phones   | **Pack files are the main path.** An import from the 5etools zip is a desktop task.                                                                                                                                                                              |
| Character choices   | **One source of truth: the per-level choice log.** There is no top-level choices map (§4.4).                                                                                                                                                                     |
| Class table columns | Referenced by a **normalized key**, not by display label (§4.3).                                                                                                                                                                                                 |
| Design              | In phase 3, the Main tab is fully styled first to set the visual system. Other tabs come after sign-off.                                                                                                                                                         |
| Mapping order       | Fixed order, A–Z by class (phase 6).                                                                                                                                                                                                                             |
| Player extras       | Deities, supernatural gifts (charms, blessings, boons), bastion facilities and 2014 character options are imported (phase 2b, §6.12, done) and used on the sheet (phases 3 and 7). Monsters, book/adventure prose, cult boons and UA psionics stay out of scope. |

---

## 1. Problems in the brief, found in the real data

### Things that are wrong

| Brief says                                        | What the data shows                                                                                                                                                                                                                                                                               | Fix                                                                                                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id = "name\|source"` for every entity            | It isn't unique. Fighter has **two** `Action Surge` XPHB classFeatures (L2 and L17). Subclass names clash across classes. PHB subclasses get **re-homed onto XPHB classes** via `_copy`. Feature UIDs leave fields empty and fall back to defaults (`Projected Ward\|Wizard\|\|Abjuration\|\|6`). | Each kind gets its own id format (§4.1).                                                                                                          |
| "5etools features are mostly text"                | True only for **class and subclass features**. Feats, species, backgrounds, items and optional features carry structured `ability`, `skillProficiencies`, `additionalSpells`, `resist`, `darkvision`, `speed`, `prerequisite`, `bonusAc`/`bonusWeapon`, `mastery`, `packContents`.                | The adapter turns structured fields into effects automatically. The hand-written `featureEffects` covers class/subclass features and a few feats. |
| Class resource counts are text                    | Second Wind uses, Rage count and Weapon Mastery count live in `classTableGroups` columns, stored as strings. Their labels can contain tags (`{@filter Cantrips\|spells\|…}`).                                                                                                                     | Columns get a **normalized key** (`second-wind`, `cantrips`), and effects reference that key (§4.3).                                              |
| Multiclass prerequisites come from data           | XPHB classes have **empty** `multiclassing` requirements.                                                                                                                                                                                                                                         | Derive them from `primaryAbility` ≥ 13 (2024 rule; Fighter is STR **or** DEX).                                                                    |
| SRD 5.2 "if present"                              | 5etools' `srd52: true` marks XPHB entries that are also in the SRD, but the text is XPHB wording.                                                                                                                                                                                                 | Never take SRD text from 5etools. SRD moves to phase 8.                                                                                           |
| Snapshot every feature **and** let errata flow in | These two conflict.                                                                                                                                                                                                                                                                               | Live content wins when it is loaded. The snapshot is a fallback cache only (§4.4).                                                                |

### Things that are missing

- **`_versions` expansion.** All XPHB species lineages and ancestries and feats like `Magic Initiate; Cleric/Druid/Wizard` use it, including `_abstract` + `_implementations` with `{{var}}` templating. XPHB has **zero** subraces.
- **`_mod` engine.** `_copy` and `_versions` share it. The ops used in the data are `replaceArr, insertArr, appendArr, removeArr, prependArr, appendIfNotExistsArr, setProp, replaceTxt`, plus `_preserve`.
- **Magic variants** (`+1 Weapon` and similar) are applied on demand in the item picker, not pre-built.
- **Optional features** (invocations, maneuvers, metamagic) use `featureType` codes plus `optionalfeatureProgression`.
- **iOS storage durability.** See §6.9.
- **Mobile import.** All the data we need, every source included, is **about 10.5 MB raw and 1.8 MB gzipped** (measured), so a full pack is phone-friendly.
- **Schema versioning.** Characters get a `schemaVersion` plus migrations. Content gets an `adapterVersion`.
- **Choice reconciliation after a re-import** (§4.4).
- **Toggleable effects** (Rage, Bladesong) need an active state.
- **Extras / familiars** need stat blocks, but the bestiary is a non-goal. Stat blocks are entered by hand (phase 7).

### Things that are over-engineered for v1

- **Homebrew editor → drop it.** Import 5etools-format homebrew through the same adapter.
- **"Every value overridable" → about 30 defined override keys.**
- **Rich-text AST → none** (§4.2).
- **Tab hide/reorder → phase 7.**
- **SQLite-WASM / OPFS → no.** It adds weight and no durability on iOS (§6.9).
- **SRD, SRD↔XPHB equivalence and 2014 handling → phase 8.** The group doesn't need them.

---

## 2. Stack and dependencies

Vite + React 18 + TypeScript (strict, `noUncheckedIndexedAccess`), plus:

- `dexie` + `dexie-react-hooks`
- `vite-plugin-pwa` (generateSW, prompt-to-update)
- `jszip`
- `react-router` with **HashRouter** (no 404 trick needed on GitHub Pages)
- `vaul` (bottom sheet)
- `@tanstack/react-virtual`
- `zod`, lazy-loaded, for validating packs and character JSON

Styling uses CSS modules plus CSS-variable design tokens. There is no global state library.

Tests use Vitest, jsdom, `@testing-library/react` and `fake-indexeddb`.

Import runs in a **Web Worker**.

---

## 3. Folder structure

The app is scaffolded at the root of `5.5e-character-sheet/`. `5etools-src-*/` is gitignored and excluded from tsconfig, eslint and vitest.

```
.gitignore            node_modules, dist, data/, *.pack.json, *.pack.json.gz, 5etools-src-*/, *.zip
.github/workflows/deploy.yml   typecheck + lint + test + content guard + build → GitHub Pages
scripts/content-guard.mjs      fails CI if any tracked file looks like game content (pack/5etools
                               JSON keys, *.pack.json*, data/). No exceptions until phase 8.
index.html            inline pre-paint theme script
vite.config.ts        pwa + vitest config, base: '/5.5e-character-sheet/'
src/
  main.tsx, App.tsx
  app/                router.tsx, AppShell, BottomNav, TopBar, theme/(tokens.css, useTheme.ts)
  schema/             PURE TYPES
    common.ts         Id, Ref, EntityKind, Ability, Skill, SourceCode, Entry, Formula, ChoiceSlot<T>
    content.ts        Spell, ClassDef, ClassFeature, Subclass, SubclassFeature, Background, Feat,
                      Species, Item, WeaponMastery, Condition, OptionalFeature, Rule
    effects.ts        Effect union
    character.ts      Character, LevelEntry, ChoiceRecord, ChoiceKey (§4.4)
    pack.ts
  db/                 db.ts, contentRepo.ts, characterRepo.ts (only code touching Dexie),
                      storage.ts (persist/estimate), backup.ts
  sources/            sourceFilter.ts
  adapters/
    fivetools/
      fs/             FileSource + dirHandle.ts, fileList.ts, zip.ts, node.ts (tests only)
      locate.ts, manifest.ts, uid.ts, mod.ts, copy.ts, versions.ts, spellLists.ts, reprints.ts
      entries.ts      normalize entry trees to our Entry union
      tableKeys.ts    class/subclass table column → normalized key
      convert/        spell, class, background, feat, species, item, optionalFeature, rules
      effectsFromData.ts
      index.ts        importFivetools(fs, opts) → ImportResult (pure)
      report.ts
    pack/             exportPack.ts, importPack.ts, packSchema.ts
    importWorker.ts
  richtext/           parseTags.ts, tagRegistry.ts, Entries.tsx, InlineText.tsx
  engine/             (phase 3+) derive/, choices/ (keys, reconcile), formula.ts, featureEffects/,
                      tables/, dice/
  features/           characters/, sheet/, library/, import/, settings/, wizard/, dev/ (design gallery)
  ui/                 BottomSheet, SwipeTabs, Button, Counter, Badge, SearchInput, VirtualList
tests/
  fixtures/fivetools/ tiny HAND-WRITTEN fake data tree with invented names
  smoke/              opt-in: FIVETOOLS_DATA=<path> npm run test:smoke (invariants only)
```

---

## 4. Draft schema

### 4.1 Ids

Ids are lowercased, with one key format per kind:

| Kind                                                           | Id                                                                                                                                              |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| spell, item, feat, background, optionalFeature, class, species | `name\|source`                                                                                                                                  |
| rule                                                           | `<ruleKind>/name\|source` (rule kinds share one table and can share names; item properties use their abbreviation, e.g. `itemProperty/v\|xphb`) |
| subclass                                                       | `shortName\|className\|classSource\|source`                                                                                                     |
| classFeature                                                   | `name\|className\|classSource\|level\|source`                                                                                                   |
| subclassFeature                                                | `name\|className\|classSource\|subclassShortName\|subclassSource\|level\|source`                                                                |

A species `_versions` variant gets its own entity with `variantOf`. A `Ref` is `{ kind: EntityKind; id: Id }`.

### 4.2 Rich text: tagged strings, not an AST

The `Entry` tree has raw tagged-string leaves (`"…{@spell Fireball|XPHB}…"`), parsed at render time with memoization. Reasons:

- It is lossless and compact.
- Renderer fixes need no re-import.
- It stays hand-writable.
- Parsing is cheap.

The tag grammar is adopted as our own documented internal format. The Entry union is our own subset: `entries | section | inset | list | table | item | quote | ref | unknown(raw)`.

### 4.3 Content types (abridged)

```ts
type Ability = 'str'|'dex'|'con'|'int'|'wis'|'cha';
type Formula = number | string;   // safe DSL, no eval: "pb", "mod.wis", "level.fighter",
                                  // "table.second-wind" (owning class), "table.fighter.second-wind",
                                  // "max(1,mod.cha)"
type ChoiceSlot<T> = { slot: string; count: Formula; from: T[] | 'any' };  // see §4.4

interface BaseEntity {
  id: Id; kind: EntityKind; name: string; source: SourceCode; page?: number;
  edition: '2014' | '2024' | 'unknown';
  supersededBy?: Id[];
  entries: Entry[]; effects: Effect[];
  origin: { adapter: '5etools'|'pack'|'homebrew'; adapterVersion: number; importedAt: number };
}

interface TableColumn {
  key: string;                     // normalized, stable, e.g. "second-wind", "weapon-mastery",
                                   // "cantrips", "prepared-spells", "rage-damage"
  label: TaggedString;             // display only, never referenced by logic
  values: (string | number)[];     // 20 rows; numeric strings parsed to numbers
}

interface ClassDef extends BaseEntity {
  hitDie: number; primaryAbility: Ability[][]; saves: Ability[];
  startingProficiencies: {...; skills: ChoiceSlot<string>};
  startingEquipment: EquipmentOption[]; multiclass: { prereq: Ability[][]; gains: {...} };
  spellcasting?: { ability: Ability; progression: 'full'|'half'|'third'|'pact'|'artificer';
    preparedByLevel?: number[]; cantripsByLevel?: number[]; spellbookByLevel?: number[] };
  table: TableColumn[]; slotTable?: number[][];
  features: { level: number; featureId: Id; gainSubclassFeature: boolean }[];
  subclassTitle: string; subclassLevel: number;
  featProgression: { key: string; name: string; categories: string[]; atLevels: Record<number,number> }[];
  optionalFeatureProgression: { key: string; name: string; featureTypes: string[]; atLevels: Record<number,number> }[];
}
interface Subclass extends BaseEntity { classId: Id; shortName: string;
  features: { level: number; featureId: Id }[]; table?: TableColumn[]; optionalFeatureProgression?: ... }
// Spell, ClassFeature, SubclassFeature, Background, Feat, Species, Item, OptionalFeature, Rule:
// as in the previous draft (spell classIds/subclassIds, item weapon/armor blocks, etc.)
```

**Table key normalization** (`tableKeys.ts`, pure and tested):

1. Render the label to its display text, so `{@filter Prepared Spells|spells|…}` becomes "Prepared Spells".
2. NFKD, then strip diacritics.
3. Lowercase.
4. Turn runs of non-alphanumerics into `-`, and trim leading and trailing `-`.
5. On a collision within a class, append `-2`, `-3` and so on, and record a report warning.

Spell slots live in `slotTable`, never in `table`. `featProgression` and `optionalFeatureProgression` get keys the same way.

Validation:

- `featureEffects` table references are checked at load time against the class's keys. An unknown key is a dev error, and it shows as a warning in the coverage report, never a crash.
- The smoke test asserts that every mapped key exists in the real data.

**Effect union:** as drafted before, with one change. Every choice-bearing effect (`abilityChoice`, `proficiencyChoice`, `expertiseChoice`, `resistanceChoice`, `featChoice`, `optionalFeatureChoice`, `grantSpells` with `choose`) carries a **`slot`** instead of a global key. The full key comes from the owning entity (§4.4).

### 4.4 Character model and choices

**Rule: build decisions live only in the per-level log.** Live play state (HP, slots, prepared spells, conditions) is separate. Snapshots are a cache. Nothing else stores choices.

```ts
interface Character {
  id: string;
  schemaVersion: number;
  createdAt: number;
  updatedAt: number;
  enabledSources: SourceCode[] | null; // null = follow global
  baseScores: Record<Ability, number>;
  scoreMethod: 'standard' | 'pointBuy' | 'manual' | 'rolled';
  log: LevelEntry[]; // THE build. log[0] = character level 1.
  inventory: InventoryItem[];
  currency: Currency;
  state: PlayState; // hp, temp, deathSaves, hitDiceUsed, slotsUsed,
  // pactSlotsUsed, resourcesUsed, conditions, exhaustion,
  // heroicInspiration, concentration, activeToggles,
  // prepared: Record<casterKey, Id[]>
  overrides: Partial<Record<OverrideKey, number | string | boolean>>;
  details: Details;
  notes: string;
  sessionLog: SessionNote[];
  portraitId?: string;
  snapshots: Record<RefKey, Snapshot>; // cache of {name, entries, effects, slots}
  ui: { tabOrder?: string[]; hiddenTabs?: string[] };
}

interface LevelEntry {
  charLevel: number; // 1..20
  classRef: Ref;
  classLevel: number; // which class gained a level
  subclassRef?: Ref; // set on the entry where it was chosen
  origin?: { speciesRef: Ref; backgroundRef: Ref }; // only on log[0]
  hp: { mode: 'avg' } | { mode: 'roll'; value: number } | { mode: 'max' }; // 'max' at char level 1
  choices: ChoiceRecord[]; // every pick made at this level, incl. origin picks
}

interface ChoiceRecord {
  key: ChoiceKey;
  values: string[]; // entity ids (spells, feats, optional features) or
  // enum values (ability codes, skill keys, tool keys)
  valueKinds?: EntityKind[]; // when values are ids
  labels: string[]; // snapshot of display names at pick time
  madeAt: number;
  via: 'creation' | 'levelUp' | 'retrain' | 'manual';
}
```

**ChoiceKey format.** It is structured in storage, and its canonical string form is used for indexing and comparison:

```ts
interface ChoiceKey {
  owner: Ref;
  slot: string;
  n?: number;
}
// canonical string:  <owner.kind>:<esc(owner.id)>#<slot>[@<n>]
// esc() percent-encodes only the reserved characters : # @ %
// examples:
//   background:sage|xphb#ability
//   species:elf; high elf lineage|xphb#spells.0.known.0
//   classFeature:weapon mastery|fighter|xphb|1|xphb#mastery
//   class:fighter|xphb#skills
//   feat:magic initiate; wizard|xphb#spells.0.known.0@2      (second time the feat was taken)
```

- **`owner`** is the entity that _offers_ the choice.
- **`slot`** is a stable local name, produced deterministically:
  - Converters name slots from data position: `ability`, `skills`, `tools`, `languages`, `feat`, `spells.<blockIdx>.<known|innate|prepared>.<i>`, `featProgression.<key>.<level>`, `optfeat.<key>.<level>` (slots never contain `: # @ %`).
  - `featureEffects` entries declare their slot names literally.
- **`n`** is the instance number, used only when the same owner can be taken more than once (repeatable feats).
- **ASIs.** Owner ids already include the level (`ability score improvement|wizard|xphb|4|xphb`), so each level's ASI or feat pick is unique without `n`.

**Where non-level-up picks go:**

- Origin picks (species, background, starting class) go in `log[0].choices`.
- A **retrain** (Fighting Style swap on level-up, Weapon Mastery swap after a long rest) replaces the original record's `values` and sets `via: 'retrain'`. The log stays the only source.
- **Manual additions** (spells copied into a spellbook, a DM-granted feat) go into the current top entry with `via: 'manual'`. Undoing that level warns that they will be removed too.

**Reconciliation after a re-import** (`engine/choices/reconcile.ts`):

- It is pure and non-destructive, and it runs on character load.
- It never writes. Only user actions write.
- For each record it computes a status:

| Status                           | Condition                                                                                                                           | Behaviour                                                                                           |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `ok`                             | Owner exists, still offers `slot`, all values valid                                                                                 | Normal                                                                                              |
| `ownerMissing`                   | Owner id not in loaded content (source not imported or disabled-and-absent, entity removed or renamed)                              | Record kept. Derive uses the owner's **snapshot** effects. "Content not loaded" badge.              |
| `aliased`                        | Owner missing, but the import report gives an explicit alias (`reprintedAs` / `supersededBy`) to an entity offering the same `slot` | Used through the alias. A one-tap "Update to new version" rewrites the key. Never automatic.        |
| `slotMissing`                    | Owner exists but no longer offers `slot` (data restructured)                                                                        | Record **excluded from derivation** and kept. Listed under "Needs attention" with a re-pick action. |
| `countMismatch`                  | Slot exists but count changed (more or fewer values than allowed)                                                                   | Extra values are ignored in derive (first N used). Missing picks show as pending.                   |
| `valueInvalid`                   | Slot exists but a picked value is no longer among the options (spell removed or renamed)                                            | Value kept and shown from `labels`, excluded from derive, with a re-pick action.                    |
| `pending` _(derived, no record)_ | Owner offers a slot with no record                                                                                                  | Shown as a pending choice. This is the same mechanism the wizard Review uses.                       |

The sheet shows a single "Needs attention (N)" chip when any record is not `ok`. Tests cover every row.

---

## 5. Phase 1: Scaffold, schema, DB, shell

| #   | Task                                                                                                                                                     | Done when                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1.1 | `git init`. Vite React TS strict, ESLint + Prettier, Vitest + jsdom, `.gitignore`. npm scripts `dev, build, preview, test, test:smoke, lint, typecheck`. | All scripts pass on an empty shell                                 |
| 1.2 | `src/schema/*` from §4, including `ChoiceKey` encode/decode helpers.                                                                                     | The types compile, and the key encode/decode round-trip tests pass |
| 1.3 | Dexie v1 (tables below) plus repos; `storage.ts`.                                                                                                        | fake-indexeddb round-trip tests                                    |
| 1.4 | App shell: HashRouter routes (§7), placeholders, BottomNav, TopBar.                                                                                      | Router test                                                        |
| 1.5 | Theme: base tokens, light/dark/system, pre-paint script. Final visual system comes in phase 3.                                                           | Toggle test                                                        |
| 1.6 | UI primitives: `BottomSheet` (vaul) with back-stack, `SwipeTabs`, `Counter`, `Badge`.                                                                    | Component tests                                                    |
| 1.7 | vite-plugin-pwa: manifest, precache, update prompt, iOS meta tags and safe-area insets.                                                                  | Build emits `sw.js` and the manifest                               |
| 1.8 | GitHub Actions: typecheck, lint, test, **content guard**, build, deploy to Pages.                                                                        | Workflow green                                                     |
| 1.9 | Storage basics (§6.9): `persist()`, a status card, an iOS "Add to Home Screen" guide.                                                                    | Unit tests                                                         |

**Dexie v1:**

```
spells 'id, source, level, *classIds, *subclassIds, name' · classes 'id, source'
classFeatures 'id, classId, level' · subclasses 'id, classId, source' · subclassFeatures 'id, subclassId, level'
backgrounds 'id, source' · feats 'id, source, category' · species 'id, source, variantOf'
items 'id, source, itemKind' · optionalFeatures 'id, source, *featureTypes' · rules 'id, ruleKind, source'
sources 'code' · characters 'id, updatedAt' · portraits 'id' · settings 'key'
```

---

## 6. Phase 2: Importer, sources, packs, library, rich text

### 6.1 The 5etools adapter pipeline (pure; runs in the worker; tested in Node)

1. **FileSource.** One interface with four implementations: `showDirectoryPicker`, a `webkitdirectory` FileList, JSZip (lazy inflate) and Node fs (tests).
2. **Locate the root.** Find the folder with `class/index.json` + `spells/index.json`. Nested zip folders are handled.
3. **Manifest (verified on 2.36.1).**
   - `class/index.json` → `class/class-*.json`
   - `spells/index.json` → `spells/spells-*.json`
   - `backgrounds.json`, `feats.json`, `races.json`, `items-base.json`, `items.json`, `magicvariants.json`, `optionalfeatures.json`, `conditionsdiseases.json`, `variantrules.json`, `actions.json`, `senses.json`, `skills.json`, `languages.json`, `books.json`, `adventures.json` (names only), `generated/gendata-spell-source-lookup.json`
   - Records are dispatched by top-level key. Unknown keys, `_meta`, `fluff-*`, `foundry-*`, bestiary, adventures and books are ignored.
4. **Import all sources by default.** Usage is controlled by enable/disable (§6.7). There is an advanced "only these sources" option.
5. **Resolve `_copy`** across all records: kind-specific UID lookup, recursion with cycle detection, `_mod` ops, `_preserve`. Unsupported ops become report warnings.
6. **Expand `_versions`**, including `_abstract`/`_implementations` with `{{var}}`.
7. **Convert** with per-kind converters:
   - normalize entries
   - build ids
   - normalize table keys (§4.3)
   - assign deterministic choice `slot` names (§4.4)
   - `effectsFromData` for structured fields: ability, proficiencies, resist/immune, darkvision, speed, `additionalSpells`, origin feat, item bonuses, feat and optional-feature progressions
   - auto-mapping (§8.1 P14): `type: options` entries become option-choice slots, and optional-feature `consumes` becomes action costs
8. **Spell lists** come from `gendata-spell-source-lookup.json` (fallback `spells/sources.json`) and fill `classIds`/`subclassIds`.
9. **Reprints.** `reprintedAs` → `supersededBy`. This also feeds the `aliased` reconcile status.
10. **`ImportResult`** holds entities, the source registry and the report (counts, warnings, unresolved refs, table-key collisions, data version).

### 6.2 Writing to the DB

There is one transaction per import, with replace-by-source semantics (stale entities deleted, new ones `bulkPut`). Characters are never touched. Reconciliation (§4.4) handles the effects when a character is next opened.

### 6.3 Packs

- **Format:** `{ format: '5e-sheet-pack', version: 1, adapterVersion, exportedAt, sources, entities }`.
- **Export:** all sources by default, as `.pack.json.gz` via `CompressionStream`. On iOS it goes out through the Web Share API, with a download-link fallback.
- **Import:** from Files, AirDrop or a chat attachment; `DecompressionStream`, then zod, then the §6.2 write path, run in the worker.

### 6.4 Rich text and rule popups

- **`parseTags`:** a brace-matching tokenizer that handles nesting.
- **`tagRegistry`:**
  - Entity tags open a bottom sheet.
  - Roll tags render styled now and become tap-to-roll in phase 3.
  - Formatting tags render as formatting.
  - Text-only tags (`filter, book, adventure, creature, card, quickref, 5etools, link, table`) render their display text. `deity`, `reward`, `facility` and `charoption` link to entities since phase 2b.
- **`<Entries>`** renders the union, with feature refs rendered inline.
- **Bottom sheet:** a tap inside a sheet replaces its content and adds a back button.

### 6.5 Library

- Search, kind chips, filters per kind and a virtual list.
- Tapping a result opens a bottom sheet.
- The source chip in the header opens the source toggles.

### 6.6 (reserved)

### 6.7 Enabling sources (2024-only until phase 8)

- **Global setting:** `enabledSources`, defaulting to `XPHB` + `XDMG` once imported. **Per character:** `enabledSources | null`.
- **`sourceFilter.isAvailable(entity, ctx)`** returns true only when:
  - the source is enabled
  - the edition is not `2014`
  - the entity is not superseded by an available reprint
- **Edition** comes from the entity `edition` field. If missing, it comes from the source edition, inferred as 2024 when any entity in the source has `edition: "one"`. This also hides 2014 subclasses re-homed onto XPHB classes (their source is PHB/XGE/TCE…).
- **The filter applies only to pickers, the library and wizards.** Refs on existing characters always resolve, with a "disabled source" badge where relevant.
- **Settings → Sources:** grouped by Core 2024 / Supplements / Adventures, with presets "2024 core" and "All 2024". 2014 sources are listed but greyed out until phase 8.

### 6.8 (moved to phase 8)

### 6.9 Storage and iOS durability

**Findings** (WebKit storage policy, Safari 17+):

- IndexedDB, Cache API, OPFS, localStorage and SW storage share **one eviction policy**.
- `persist()` is granted by heuristics, such as running as a Home Screen app.
- **Swapping IndexedDB for OPFS or SQLite-WASM gains no durability.**

| Option                                                      | Durability            | Cost                                | When                     |
| ----------------------------------------------------------- | --------------------- | ----------------------------------- | ------------------------ |
| **Dexie + user-owned backup files**                         | Good if users back up | Low                                 | **v1**                   |
| Capacitor native shell (data in the app container)          | Full                  | Apple Developer Program, TestFlight | Later, if eviction bites |
| Sync to the user's own cloud via OAuth (no backend of ours) | Full + cross-device   | OAuth setup; v1 non-goal            | Later                    |

**v1:**

- All DB access goes through repos, so a native or sync backend can slot in later.
- iOS asks users to install to the Home Screen first. Separate Safari vs installed-app storage is to be verified on a device in phase 1; if confirmed, imports happen inside the installed app.
- `persist()` is requested after install or on the first save.
- **Backups:**
  - "Backup all characters" writes one JSON file, sent to Files/iCloud through the share sheet.
  - Desktop Chromium can auto-save to a backup file the user picked (File System Access API).
  - Restore merges by id, and the newer version wins after a prompt.
  - A reminder banner appears after 7 days with unbacked changes.
- Content needs no backup, because it can be rebuilt from the group's pack file.

### 6.10 Phase 2 tests (hand-written fixtures only)

- **Adapter:** uid defaults, each `_mod` op, `_copy` (chains, cycles, `_preserve`, cross-source parent), `_versions` (plain and abstract), locate, zip FileSource.
- **Table keys:** tagged labels, diacritics, collisions, stability across re-import.
- **Slots:** deterministic slot names, so the same fixture always gives the same slots and re-import keeps keys stable.
- **Converters:** one fixture entity per kind, plus `effectsFromData`.
- **Data:** spell lookup join, reprints.
- **DB:** replace-by-source.
- **Packs:** round trip is deep-equal.
- **Rich text:** about 20 `parseTags` cases, plus an Entries snapshot.
- **sourceFilter:** edition fallback, re-homed 2014 subclass hidden, superseded, disabled source, per-character override.
- **Backup:** export → restore round trip.
- **Smoke (opt-in):** all sources, no crash, no unresolved `_copy`, no table-key collisions in XPHB.

### 6.11 Order of work in phase 2

1. Adapter core
2. Converters, table keys, slots, effects, spell lists, reprints
3. DB write and worker
4. Packs
5. Rich text and library
6. Source filter and settings
7. Backup flow

### 6.12 Phase 2b: player extras (done)

Four more 5etools files hold content players use. Counts are from 2.36.1.

| File                       | Records                                                                                                                                             | What it is                                                                                       | Becomes                                                                        |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `deities.json`             | 563 `deity` (PHB 195, SCAG 99, MTF 80, FRHoF 42, EGW 32, XDMG 27…)                                                                                  | Gods with pantheon, alignment, domains, province, symbol                                         | New kind **`deity`**                                                           |
| `rewards.json`             | 278 `reward`: Charm 138, Piety Trait 60, Boon 26, Blessing 22, Fragment of Suffering 9, Inhabitation 9, Draconic Gift 8, Curse 4, Other 2 (XDMG 19) | Supernatural gifts a DM hands out; many carry structured `additionalSpells`, `ability`, `resist` | New kind **`reward`**, with `rewardType`                                       |
| `bastions.json`            | 70 `facility` (XDMG 35, EFA 10, AU 9, FRHoF 8, RHW 8)                                                                                               | 2024 Bastion facilities: type (basic/special), level, prerequisite, space, hirelings, orders     | New kind **`facility`**                                                        |
| `charcreationoptions.json` | 44 `charoption` (IDRotF 17, VRGR 13, MOT 9…): Supernatural Gifts, Dark Gifts, Character Secrets, Racial Feats                                       | 2014-era creation options                                                                        | New kind **`charOption`** (2014, so hidden until phase 8 by the source filter) |

Not imported, on purpose: `cultsboons.json` (DM-side demonic boons and cults), `psionics.json` (2014 Unearthed Arcana mystic).

Work:

1. **Schema:** add the four kinds to `ENTITY_KINDS` with their types (`Deity { pantheon, alignment[], domains[], province?, symbol? }`, `Reward { rewardType }`, `Facility { facilityType: 'basic'|'special', level, prerequisites, space[], hirelings, orders[] }`, `CharOption { optionTypes[] }`). Ids are `name|source`, except deities: `name|pantheon|source` (5etools deity UIDs include the pantheon, and names repeat across pantheons). Bump `ADAPTER_VERSION` to 2.
2. **Database:** Dexie version 2 adds `deities 'id, source, pantheon'`, `rewards 'id, source, rewardType'`, `facilities 'id, source, facilityType, level'` and `charOptions 'id, source'`. Packs accept the new kinds; packs from version 1 still import.
3. **Importer:** read the four files, convert the records, and run `effectsFromData` on rewards and character options. That gives charm and blessing spells (including the `limited` uses form), ability increases and resistances. A charm's limited uses become a `resource` effect with recharge `none`.
4. **Rich text:** `{@deity}`, `{@reward}`, `{@facility}` and `{@charoption}` become entity links (now text only).
5. **Library:** new tabs for Deities (filters: pantheon, domain), Gifts (filter: type), Bastion (filters: type, level) and Options (2014, hidden while 2014 is off).
6. **Tests:** a fixture record of each kind; deity ids across pantheons; charm effects; a version-1 pack still imports; the smoke test counts the new kinds and checks that 2024 rewards and facilities have no failed conversions.

Estimate: about 1.5 days.

**As built** (differences from the work list above):

- **Gift uses are one counter per gift:** a `resource` effect (`resourceId: 'uses'`, recharge `none`, labelled Charges or Uses) on the reward, and its `limited` spells are paid from it (`uses: { resource: 'uses', cost }`). The count comes from the text ("has 3 charges", "once used three times"), else the `limited` spell data, else single-use wording ("once you do so", "until you use it", "expend the Charm"); "(2 charges)" after a spell sets its cost. Gifts that last a set time or for good, or recharge on a rest, get no counter. 114 of 138 charms in 2.36.1 get one; the rest are duration or permanent gifts.
- Spell uses everywhere: a count without the `e` ("each") suffix over several spells becomes a `resource` effect the spells share (`uses: { resource, cost: 1 }`, "cast one of these once"); `resource` keys become `uses: { resourceName, cost }` (Ki, Focus Points); `#3` suffixes become `castAtLevel`; ability and `pb` counts become formulas (`max(1,mod.wis)`, `pb`). Rewards carry no `ability` or `resist` fields in 2.36.1, so spells are their only structured effects.
- **Deities follow the source switches** like every other kind (2014 pantheons unlock in phase 8). 2024 books with gods in 2.36.1: XDMG (27, Greyhawk) and FRHoF (42, Faerûn). 5etools links later printings of a god at load time; the importer does the same into `supersededBy`, matching on name (or `reprintAlias`) **and** pantheon (Forgotten Realms = Faerûnian, Gnome = Gnomish), so older printings are hidden.
- `reprintedAs` entries tagged as another kind (a reward reprinted as a feat) are skipped for the new kinds and for feats, backgrounds, species, items and optional features.
- Facility prerequisites (membership, spellcasting focus, expertise) and character option race prerequisites become `other` text.
- `PACK_VERSION` stays 1: it goes up only for a change an older app would misread. New kinds are additive: an app imports the kinds it knows, skips the rest with a `kindUnknown` warning, and records source counts from what it stored. Apps from before phase 2b drop unknown kinds silently and keep the pack's counts, so the library shows those tabs empty with an "Import the pack again" link.
- Library tabs: Gifts, Deities (pantheon, domain, alignment), Bastion (type, level), Creation options (type). A tab is hidden when no usable source has that kind, so Creation options stays hidden until 2014 sources unlock in phase 8.
- 5etools `itemGroup` records (Arcane Focus, Holy Symbol, Artisan's Tools, Ioun Stone…, 119 in 2.36.1) are imported as items with `groupItemIds` and a member list appended to their text, so `{@item Arcane Focus|XPHB}` links resolve.
- File inputs give Chrome on Android a single `accept` type (`application/*`); several types make it open a Camera / Photos chooser instead of Files.

**On the sheet** (no new engine primitives needed):

- **Phase 3, Description tab:** a deity picker (filtered by pantheon), stored as a `ChoiceRecord` with `via: 'manual'` and shown with its symbol and domains.
- **Phase 3, Features tab:** a "Gifts" section where you add a charm, blessing or boon the DM gave you. Its effects apply like a feat's, its `uses` counter is tracked and spent like any resource (casting one of its spells spends the cost), and a used-up charm can be removed. Gifts are `manual` records in the current top log entry, so level-up undo warns about them (§4.4).
- **Phase 7, Bastion:** a Bastion section for characters level 5 and up. It lists your facilities, with the number of special facilities following the XDMG table (2 at level 5, 4 at 9, 5 at 13, 6 at 17). It records hirelings and the order each facility is on this turn, and links facility charms (such as the Arcane Study Charm) to the Gifts section. Bastion turns are tracked by hand; there is no automatic simulation of orders.

---

## 7. Screens and navigation

```
Bottom nav:  Characters | Library | Settings

#/                         Character list · FAB "New" · row menu: duplicate, export JSON, delete
#/c/:id/:tab               Sheet. Tabs (swipe): Main · Actions · Spells · Inventory · Features ·
                           Description · Notes · (Extras)
                           sticky header: name, HP pill, AC, conditions, "Needs attention (N)" chip
                           overflow: Level up, Short rest, Long rest, Sources, Edit overrides
                           floating: dice button → roller sheet
#/c/:id/level-up           Level-up wizard
#/new/:draftId/:step       Creation wizard (class → background → species → abilities →
                           equipment → spells → details → review), draft autosaved
#/library?kind=&q=         Content browser
#/library/import           Import: pack file (primary) · 5etools folder/zip (desktop)
#/settings                 Theme · Sources · Export pack · Storage · Backup/restore
#/dev/design               Component/token gallery (dev builds only), used for the phase 3 design sign-off
First run:                 "Import your group's pack" card (iOS: install first)
Global:                    Rule bottom sheet, dice roller sheet, backup-reminder banner
```

---

## 8. Engine primitive survey (level A automation)

**How I did it.** I read the full text of every XPHB class feature (283) and XPHB subclass feature (309, 48 subclasses) from the local 2.36.1 data. I also read the 58 XPHB optional features (invocations, maneuvers, metamagic) and the 23 Fighting Style and Epic Boon feats, because class features grant them.

**What I was looking for.** What level A needs ("changes a number on the sheet, or is a counter to track") that the effect types in §4.3 cannot already express.

**Effect types that already exist:** abilityBonus/Choice, proficiency/Choice, expertise, acFormula, acBonus, speed/speedBonus, sense, resistance/immunity/conditionImmunity, resource (max formula + recharge), grantSpells, grantAction, extraAttack, hpBonus, initiativeBonus, weaponMasteryCount, featChoice, optionalFeatureChoice, toggle, note, plus the formula DSL with `table.<key>`.

### 8.1 New primitives needed

Counts are approximate numbers of XPHB features that need each primitive. Estimates are focused engineering days including tests, ±30%.

| #   | Primitive                                        | What it adds                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Example features                                                                                                                                                                                                                         | ~Features | Est. |
| --- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---- |
| P1  | **Effect predicates** (`when`)                   | A condition on _any_ effect, evaluated against static state: armor worn (none / not heavy / any), shield held, wield state, toggle active, has condition.                                                                                                                                                                                                                                                                                                                                                               | Unarmored Defense (Barbarian: shield OK; Monk: no shield), Fast Movement, Unarmored Movement, Roving, Defense FS, Draconic Resilience AC, Falcon fly speed                                                                               | 15        | 1.5  |
| P2  | **Equipment and wield state**                    | Inventory slots for armor, shield, main hand, off hand, both hands. Derived flags (armor category, free hands, wielded weapons, "monk weapon" = simple melee or martial melee with Light).                                                                                                                                                                                                                                                                                                                              | Dueling, Great Weapon Fighting, Two-Weapon Fighting, Versatile damage, Martial Arts, Unarmed Fighting (d8 with both hands free), Psychic Blades                                                                                          | 10        | 1.5  |
| P3  | **Attack model + attack modifiers**              | Attacks as first-class objects (weapons, built-in Unarmed Strike, pact/bonded weapon, spell attacks). Modifiers have a filter (melee/ranged, weapon/unarmed/spell, property, category, ability used, specific item) and can be: allowed-ability set (best of), to-hit bonus, damage bonus, **damage-die override** (max of base and override), crit range, extra-attack scoped to a filter.                                                                                                                             | Rage damage (STR attacks), Martial Arts die + Dexterous Attacks, Pact of the Blade (CHA), Thirsting Blade, Archery, Dueling, Thrown WF, Improved/Superior Critical, Bardic Damage, Sacred Weapon                                         | 25        | 3.5  |
| P4  | **Damage riders**                                | Optional extra damage listed under each matching attack, with a tap to add it to the roll. Each rider has dice (formula), type, filter, frequency hint (once/turn), an optional cost (resource or slot), and an optional toggle gate. Riders can be always-on or opt-in.                                                                                                                                                                                                                                                | Sneak Attack (`table.sneak-attack`), Divine Fury, Radiant Strikes, Divine/Primal Strike (1d8→2d8), Dreadful Strikes, Gloom Stalker Dreadful Strike, Colossus Slayer, Hand of Harm, Eldritch Smite, Lifedrinker, Frenzy                   | 15        | 1.5  |
| P5  | **Dice-valued formulas**                         | Formulas can return dice, not just numbers. Parses table strings ("3d6", "d8", "+10 ft."). Adds `steps(level.x, {lvl: value})` thresholds, `floor`/`half`, and dice counts computed from formulas.                                                                                                                                                                                                                                                                                                                      | Sneak Attack dice, Martial Arts / Bardic dice from tables, Divine Spark 1d8→4d8, Land's Aid, Indomitable 1/2/3, Superiority dice 4/5/6 and d8→d12, Psionic dice (subclass table), Warrior of the Gods 4→7 d12                            | 35        | 1    |
| P6  | **Resource extensions**                          | `die` (dice pools); `pool` kind (spend any amount); `resourceModify` (later features change recharge, max or die); `restoreWith` (restore a use by spending another resource or a slot of level ≥ N); multiple actions sharing one resource.                                                                                                                                                                                                                                                                            | Lay on Hands, Focus/Sorcery Points, Superiority and Psionic dice, Healing Light, Font of Inspiration (BI on short rest at 5), Improved Warding Flare, ~25 "restore by expending Rage / die / slot" features, Channel Divinity options    | 40        | 1.5  |
| P7  | **Actions with costs and self-outcomes**         | ActionDef gains costs (resource N, slot, pool amount), a roll (attack ref, save DC formula such as `8+mod.str+pb` or `spelldc.cleric`, dice), multi-attack actions, and **self outcomes applied on tap** (heal self, gain temp HP, activate toggle).                                                                                                                                                                                                                                                                    | Second Wind, Wholeness of Body, Uncanny Metabolism, Tireless, Flurry of Blows, Bonus Unarmed Strike, War Priest, Turn Undead, Divine Spark, Preserve Life (pool display), maneuver costs (from `consumes`)                               | 90        | 2    |
| P8  | **Toggles v2 (stances/forms)**                   | Toggles get activation costs, on-activate outcomes (temp HP), a sub-option picked at activation, mutual-exclusion groups, and end-on-rest. Inside a toggle sit resistances, speed modes, roll modifiers, riders, condition immunities and spell DC changes.                                                                                                                                                                                                                                                             | Rage (+ Rage of the Wilds / Power of the Wilds options, Vitality Surge temp HP), Innate Sorcery (DC +1), Starry Form (Archer/Chalice/Dragon), Wrath of the Sea, Elemental Attunement, Sacred Weapon, Dragon Wings, Rage of the Gods      | 15        | 1.5  |
| P9  | **Roll modifiers**                               | `rollMode` (advantage/disadvantage marker) and `rollBonus` (formula) on targets `save:<ab>`, `save:all`, `save:concentration`, `check:<ab>`, `skill:<sk>`, `initiative`, `deathSave`, `attack:<filter>`. Plus `halfProficiencyUnproficient` (Jack of All Trades, initiative included) and `rollFloor` (display).                                                                                                                                                                                                        | Danger Sense, Feral Instinct, Rage STR advantage, Remarkable Athlete, Assassinate, Thaumaturge/Magician (+WIS to Arcana…), Otherworldly Glamour, Aura of Protection, Dread Ambusher initiative, Eldritch Mind, Survivor, Reliable Talent | 30        | 1    |
| P10 | **Choice-bound parameters + dynamic options**    | Effect values can reference a choice's value (`fromChoice: slot`). Option lists can be dynamic queries (proficient skills without expertise, saves not proficient, known cantrips that deal damage). Each choice has a retrain cadence (`levelUp`, `shortRest`, `longRest`).                                                                                                                                                                                                                                            | Elemental Affinity (type → resistance + spell bonus), Fiendish Resilience, Agonizing Blast (chosen cantrip), Nature's Ward (land), Aspect of the Wilds, Hunter's Prey, Expertise / Deft Explorer / Scholar, Iron Mind fallback           | 20        | 1.5  |
| P11 | **Spellcasting extensions**                      | Subclass casters (EK, Arcane Trickster: subclass table, Wizard list). **Pact Magic** (`table.spell-slots` + `table.slot-level`, short rest). Multiclass slot table with pact kept separate. A **spell filter DSL** shared with 5etools `choose` strings (class list(s), school, level ≤ accessible, cantrip, ritual, deals damage). Off-list spells counting as class spells. At-will and N/rest free casts. Spell modifiers (per-class DC bonus; damage bonus by filter). Temporary extra slots. Slot-recovery action. | Eldritch Knight, Arcane Trickster, Pact Magic, Mystic Arcanum, Magical Secrets/Discoveries, Savants, Potent Spellcasting, Empowered Evocation, Radiant Soul, Spell Mastery, Signature Spells, Font of Magic, Arcane/Natural Recovery     | 35        | 3    |
| P12 | **Secondary HP layer**                           | A ward pool that absorbs damage after temp HP and before HP, with its own max formula and regain.                                                                                                                                                                                                                                                                                                                                                                                                                       | Arcane Ward (max 2×level + INT)                                                                                                                                                                                                          | 2         | 0.5  |
| P13 | **Prerequisite evaluator**                       | Evaluates 5etools structured `prerequisite` (level, ability, proficiency, spellcasting, other feat/feature/pact, known spell) for feats, invocations and multiclassing.                                                                                                                                                                                                                                                                                                                                                 | Thirsting Blade (Pact of the Blade, L5), Agonizing Blast, GWM (L4, STR 13), multiclass ≥ 13                                                                                                                                              | 30+       | 1    |
| P14 | **Adapter auto-mapping** _(phase 2, not engine)_ | Generates effects from data so they don't need hand mapping: `type: options` entries become option choices; optional-feature `consumes` becomes action costs; `additionalSpells` on subclasses and optional features becomes grantSpells; feat/optional-feature progressions become choice slots.                                                                                                                                                                                                                       | Divine Order, Primal Order, Elemental Fury, domain/oath/patron spell lists (all 48 subclasses), Armor of Shadows-type invocations, maneuver/metamagic costs                                                                              | 60+       | 1    |

**Total: about 22 engineering days for the primitives.** The hand mapping on top of them is about 180 level-A entries at 10–15 minutes each with the draft helper, roughly 4–5 days.

**Kept out of level A on purpose** (text, counters only, or a later phase):

- Brutal Strike and Cunning Strike effect menus (B: list options and dice cost)
- reactions such as Uncanny Dodge, Evasion and Deflect Attacks (text plus an action entry)
- auras that affect allies
- "once per turn" enforcement (shown as a hint only)
- regeneration at turn start
- reach changes
- Portent stored rolls
- the Wild Magic table
- teleports
- **Wild Shape stat replacement and companions/familiars** (phase 7 Extras)

**The same primitives cover species and feats.** Breath Weapon is P7 + P5. Dwarven Toughness is hpBonus. Goliath and Orc uses are resource = PB. Boon of Fortitude is hpBonus.

### 8.2 Engine design rules from the survey

1. **Two-pass evaluation, no cycles.** Predicates (P1) and choice-bound values (P10) may only read _static state_: levels, base scores, choices, equipment and wield state, active toggles, conditions, resource usage. They never read derived numbers. Dynamic option lists (P10) are computed in the choice UI from the previous derived sheet, never inside `derive`.
2. **Typed buckets, not ad-hoc fields.** Effects are collected into buckets: AC candidates/bonuses, speed, senses, defenses, proficiencies, roll modifiers, attack modifiers, damage riders, spell modifiers, resources, actions, toggles and spellcasting. Each stage reads only its buckets.
3. **Every number carries its explanation.** Each derived value keeps a list of `Contribution {source: Ref, label, value}`, so tapping AC, a save or an attack shows _why_ (this fits "everything tappable"). The same lists make golden tests readable, and overrides show up as one more contribution.
4. **Play actions are pure reducers** over `state`: `applyDamage` (temp → ward → HP), `heal`, `spend`/`restoreWith`, `useAction` (costs, then outcomes, then roll), `toggle(on/off)` (cost, then onActivate), `shortRest`, `longRest`. The UI dispatches these. They are unit-tested without React.

---

## 9. Phases 3–8 (outline)

**Phase 3: Character model, engine, sheet pages, play tools** (built against §8)

1. **Engine core.** Built in this order, each step fully tested before the next:
   1. Formula DSL with dice values and `steps` (P5), then `ContentIndex`, then reconcile choices (§4.4).
   2. Static state: equipment and wield (P2), predicates (P1), toggles v2 (P8), choice-bound parameters (P10).
   3. Collect effects into buckets (data effects + `featureEffects` + active toggles) with `Contribution` tracking.
   4. Abilities (caps) → PB → saves/skills/passives + roll modifiers (P9) → AC candidates → HP + ward (P12) → speed/senses/defenses.
   5. Attacks: the attack model + modifiers (P3), then damage riders (P4), then mastery.
   6. Spellcasting (P11): per-caster DC/attack, slots (multiclass + pact), prepared limits, spell modifiers.
   7. Resources (P6) → actions (P7) grouped by type → exhaustion/conditions → overrides.
   8. Play reducers (§8.2 rule 4) and the dev manual-character editor that writes a valid `log`.

   The prerequisite evaluator (P13) lands in phase 4, where feat and invocation pickers need it. Adapter auto-mapping (P14) belongs to phase 2.

2. **Visual system on the Main tab (gate).** Fully design and build the Main tab:
   - **Tokens:** type scale, spacing scale, semantic colour tokens for light and dark, radii, elevation, motion.
   - **Components:** ability block, save/skill rows with proficiency and expertise markers, stat pills (AC, initiative, speed, PB), HP widget with damage/heal/temp input, hit dice, death saves, condition chips with exhaustion level, override marker, source and "content not loaded" badges, section headers.
   - **Layouts:** phone, tablet and desktop breakpoints.
   - **`#/dev/design` gallery** showing every component in both themes.

   **Sign-off gate:** you review it on your devices. I verify through code and tests only. The other tabs start after sign-off and reuse the same components and tokens.

3. **Remaining tabs:** Actions, Spells, Inventory, Features (with the Gifts section, §6.12), Description (with the deity picker, §6.12), Notes.
4. **Play tools:**
   - HP and temp HP
   - short and long rest (2024 rules)
   - dice: `NdM+K`, adv/dis, history, tap-to-roll tags
   - conditions and concentration
5. **Tests:**
   - one fixture test per primitive P1–P12, built on invented features that use it
   - golden `DerivedSheet` (with `Contribution` lists) for 4 fixture characters covering a martial, a half-caster, a full caster with pact multiclass, and an unarmored/monk-style build
   - every reconcile status
   - every play reducer

**Phase 4: Creation wizard (level 1, single class)**

- A generic `ChoicePicker` driven by pending slots.
- Every pick writes a `ChoiceRecord` into `log[0]`.
- Review lists pending and non-`ok` choices.
- Ability scores: standard array, point buy, manual entry, 4d6-drop-lowest.
- Equipment packages or gold.
- Spells filtered by class list and level, with counts enforced.

**Phase 5: Level-up, higher-level creation, multiclass, preparation**

- Level-up: `pendingChoices` for the new `LevelEntry`, HP average or roll, multiclass prerequisites from `primaryAbility`.
- **Undo:** pop the last `LevelEntry`, warning about `via: 'manual'` records.
- Higher-level creation loops the level-up flow.
- Preparation: `state.prepared`, plus wizard spellbook additions as `manual` records.

**Phase 6: `featureEffects` mapping**

- **Why it exists:** class and subclass features are prose. Computing from them means encoding each one once.
- **Size:** 283 XPHB class features and 309 XPHB subclass features. About 180 level-A entries remain after auto-mapping (P14), at roughly 4–5 days. Every entry uses only the primitives in §8.1. A feature that needs a new primitive is logged and goes back to the engine backlog, never worked around in mapping data.
- **Automation levels:**
  - A: numbers and counters
  - B: toggles
  - C: text, plus a counter if the feature has uses
- **Order:**
  1. all 12 XPHB classes A–Z with their XPHB subclasses
  2. XPHB feats
  3. 2024 supplement subclasses
- **Tooling:** the draft-mapping helper and a coverage report.
- **Key checks:** mappings reference table keys and declare slots, and both are validated (§4.3).
- **Tests:** per class at levels 1/3/5/11/20.

**Phase 7: Extras, homebrew, polish**

- Extras with hand-entered stat blocks.
- Bastion section (§6.12).
- 5etools-format homebrew import.
- Tab hide/reorder.
- Install prompt.
- Accessibility, UX and performance pass on a low-end phone and an older iPhone.
- Storage decision point (Capacitor or sync) if eviction shows up in practice.

**Phase 8: Public-readiness and legacy content (any time after phase 5)**

- **SRD 5.2.1 bundle:**
  - a time-boxed spike to choose a CC-BY structured conversion and check it against the official PDF
  - `tools/srd/` converter → committed `public/srd/srd52.pack.json.gz`
  - auto-load on first run
  - attribution in About and `LICENSE-SRD.md`
  - a content-guard exception for that one file
- **SRD↔XPHB equivalence:** `equivalentOf`, a rename map, hiding SRD twins, and `featureEffects` reached through equivalence.
- **2014 content:** a "Show 2014" toggle (global and per character), presets including 2014, and mappings for re-homed 2014 subclasses.
- **Optional:** a Netlify or other host switch if a private URL is wanted again.

---

## 9b. Phase 2 implementation notes

- Rule ids carry their rule kind (§4.1).
- Effect union additions for P14: `optionChoice` + `ifChoice` (alternative sets: ability +2 or +1/+1, Magic Initiate lists), `featureOptions` (`type: options` blocks), `atLevel` (progression gating), `abilitySet` (items). `grantSpells` covers known, always prepared, innate and expanded spells, uses (N per rest, at will, ritual) and `{ all: filter }`.
- Prerequisites are `Prereq[][]` (any-of groups of all-of requirements), as in 5etools.
- `SourceInfo` has `group` (core / supplement / adventure / other) and `published`. Source edition is 2024 if any entity is marked `one` or the book is dated on or after 2024-09-17.
- Magic variants are items with `itemKind: 'variant'` and a `variant` block; applying them to base items belongs to the item picker.
- 2014 subraces merge into species variants (5etools rules); their `_versions` expand after the merge.

## 10. Open questions

None are blocking.

## 11. Risks

- **Primitives missed by the survey.** The survey covered XPHB only. Supplement subclasses and 2014 re-homed subclasses (phase 8) may need a few more. Mitigation: the §8.2 bucket design leaves room to extend, and phase 6 logs gaps instead of hacking around them.
- **P3 (attack model) is the largest and most connected piece**, at about 3.5 days. It comes after P1/P2 and before riders, so errors surface early in golden tests.
- **The phase 3 design gate adds a review round-trip.** It is intended; it prevents restyling six tabs later.
- **5etools format drift.** Report warnings plus the smoke test on each update. Stable table keys and slots mean ordinary data updates don't break characters, and reconciliation covers the rest.
- **Low-end phones.** Worker import, memoized derive, virtual lists. A full pack is about 1.8 MB gzipped.
- **Storage loss on iOS.** Home Screen install, `persist()`, backups and nudges, with Capacitor or sync as the escape hatch.
- **Public repo.** It holds code only, and the CI content guard enforces that.

## 12. Verification (per phase)

- `npm run typecheck && npm run lint && npm test` must be green. Acceptance items are covered by tests on hand-written fixtures.
- `FIVETOOLS_DATA=./5etools-src-2.36.1/5etools-src-2.36.1/data npm run test:smoke` is opt-in and local, and checks invariants only.
- `npm run build && npm run preview` show the SW and manifest are generated. You do the UI, design-gate and iOS checks on your devices (install, persist, pack import in the installed app, backup to Files). I verify through code and tests only.
- The CI content guard runs on every push.
