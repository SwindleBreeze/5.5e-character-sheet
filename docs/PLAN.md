# 5.5e Character Sheet: Plan

> **Status (2026-10-09):** phases 1–7 are done and live. The group's first campaign starts on
> what is there; play-test fixes go into the **7.10 buffer**. Phase 8 (2014 content) has
> started: 2014 options can be picked for 2024 characters (8.1–8.2); their features' effects
> (8.3) come in the order players pick them. Phase 9 (public release) waits until publishing is decided.
>
> The full plan for phases 1–7 (design, schema, engine, every step's notes) is archived word for
> word in [history/PLAN-phases-1-7.md](history/PLAN-phases-1-7.md). Code comments that cite
> "plan §…" or "step …" for phases 1–7 refer to it; steps 7.10 and 8.x–9.x are in this file.

## 1. What this is

An offline-first character builder and sheet for D&D 2024 rules, installed as a web app (PWA).
Its job: **help players read, understand and track their character; don't play the game for
them.** Every number a player needs (AC, to-hit, damage, save DCs, slots, HP) is worked out and
explained, for newcomers as much as for experienced players. Rolls mostly happen with real dice.

Rules that every step follows:

- **The purpose test.** A step must help a player read, understand or keep track of their
  character. No triggers, no reactions resolved, no turn tracking, no enforcement.
- **Guide, allow override.** Pickers filter and count; every limit has an "Ignore rules" switch,
  and a broken rule is a warning, never a block. The player's own number always wins.
- **No game content in the repo or the hosted site,** our own summaries of it included. Content
  is imported on each device and stays there. The CI content guard enforces this. The one
  planned exception is the SRD bundle (phase 9), which is licensed for it.
- **Every step ends checked:** unit or UI tests on hand-written fixtures, the real-data smoke run
  where real data is involved, and a look on a phone for screens.
- **Keep the code small.** New state, pickers or flows must prevent a mistake a player would
  actually make.

## 2. Where we are

| Phase | What                                                                                   | State                            |
| ----- | -------------------------------------------------------------------------------------- | -------------------------------- |
| 1     | Scaffold, schema, database, app shell, PWA, CI with the content guard                  | Done                             |
| 2, 2b | Importer, sources, packs, library, rich text; deities, gifts, Bastions, 2014 options   | Done                             |
| 3     | Engine, Parchment design, every sheet tab, play tools                                  | Done                             |
| 4, 4B | Creation wizard, creation guide and explanations                                       | Done                             |
| 5     | Level-up, undo, higher-level creation, multiclassing, preparation, retraining          | Done                             |
| 6     | Every 2024 class, subclass, feat and species feature mapped; golden checks; play tests | Done                             |
| 7     | Homebrew, companions, durability, accessibility, performance, magic items              | Done; 7.10 buffer open           |
| 8     | 2014 content, from every book                                                          | 8.1–8.2 done; 8.3 in order asked |
| 9     | Public release: SRD bundle, import your own content, legal pages                       | When publishing is decided (§5)  |

Numbers on `main`: 864 unit tests in 101 files; 233 real-data checks in 21 files
(`FIVETOOLS_DATA=… npm run test:smoke`).

## 3. Now: play and fix (7.10)

The campaign is the test. Anything that reads wrong, adds up wrong or gets in the way at the
table goes into this buffer and is fixed with a test that would have caught it, checked against
real data where it touches content.

**Fixed so far (2026-10-09):** the wizard's first tap lost while sources loaded; tabs that
scrolled sideways; a removed class showing its id; picks that unlock other picks (Primal Order →
Magician, and every case like it, swept over every 2024 class, subclass, background and
species); the Characters screen order; the phone's back button; Android's file chooser; the app
noticing new versions; weight carried slowing the Speed; browsers darkening the themes.

**Still known:** about 15 features and items show their text with a note on what the engine
lacks (archive §10.3, step 7.13). Content imported before adapter 7 lacks creatures; the app asks
to re-import it.

**Checkpoint (open):** a homebrew class or subclass from creation to level-up; a druid's forms
and a companion through a session; the app within budget on the slowest phone in the group
(cold start under 3 s, sheet open under 0.5 s, a tap answered under 100 ms; 7.9 measured these
in an emulated slow browser, not yet on real phones).

## 4. Phase 8: 2014 content (from every book)

Built only when a player wants a 2014 option, and then in the order players ask. **Scope is every
book in the data, not just the 2014 Player's Handbook** (decided 2026-10-09). In 5etools 2.36.1
that is about 130 subclasses beyond the 2024 ones (PHB 40, Xanathar's 31, Tasha's 30, Sword
Coast 6, and the rest spread over a dozen books), about 100 feats, and about 140 species with 98
subraces. The 5etools data re-homes 2014 subclasses onto the 2024 classes, which makes 8A cheap.

### 8A. 2014 options on 2024 characters (what the 2024 Player's Handbook allows)

| Step | Work                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Est. |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| 8.1  | **"Show 2014 content".** **Done 2026-10-09.** A setting in Settings → Sources lets 2014 books be switched on (globally, and in a character's own book list), with an "Every book" preset; a 2024 reprint still hides its 2014 original. Off again, 2014 content is hidden and the books stay switched on for later. In code: `offeredSources` and the `SHOW_2014` mark (`src/sources/sourceFilter.ts`); the toggles edit the stored list.                                                                                                                                                                                                                                                                                                                                            | 1    |
| 8.2  | **2014 options in the wizard and level-up.** **Done 2026-10-09.** 2014 subclasses need nothing: the data re-homes them onto the 2024 classes with their features at the 2024 levels (61 offered, every one builds 1 → 20 clean). A 2014 species' ability increases give way to the background's, with a switch on the Species step to keep them (then the background gives none: `Character.legacyAbilities`). A 2014 feat (no category) is a General feat. A 2014 background gets free +2/+1 or +1/+1/+1 (a grid of +2/+1 per ability, not fifty combinations) and an Origin feat pick, with a notice. Spells a 2014 feature makes known are always prepared, not counted against the 2024 limit (Divine Soul, Lunar Sorcery). In code: `src/engine/rules/legacy.ts`, `SpreadGrid`. | 3    |
| 8.3  | **Their features on the sheet.** Every 2014 subclass, feat and species from every book gets a mapping with phase 6's tooling (`featureEffects/legacy/`), at levels A and B; what the engine can't do shows the imported text with a note. The coverage gate reports 2014 apart. Done in the order players pick them, then the rest book by book.                                                                                                                                                                                                                                                                                                                                                                                                                                     | 8    |
| 8.4  | **Tests.** **Started 2026-10-09:** `tests/smoke/legacy.test.ts` builds every 2014 subclass 1 → 20 on its 2024 class (and through level-up at 3) with no warnings and every pick on screen, every 2014 species and background through the wizard, and checks every 2014 feat is offered at level 4; fixture unit and wizard tests for each rule. Left: golden checks at 3, 5, 11 and 20 for each subclass once 8.3 maps them.                                                                                                                                                                                                                                                                                                                                                         | 2    |

**8A total: about 14 days; 8.1–8.2 alone (about 4) make 2014 options pickable, with their text.**

### 8B. Characters on 2014 rules (only if the group plays 2014 rules)

| Step | Work                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Est. |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 8.5  | **A ruleset per character** (`2014` or `2024`, chosen at creation). For 2014: ability increases from the species; backgrounds without increases or feat; Ability Score Improvements or a feat at the class's levels; 2014 classes and subclass levels; prepared counts from level + modifier, known spells for Bard, Ranger, Sorcerer and Warlock; no Weapon Mastery; 2014 multiclassing, exhaustion and starting equipment. The guide text follows the ruleset. | 5    |
| 8.6  | **2014 class features.** The 2014 classes' own features mapped (where they differ from 2024), levels A and B.                                                                                                                                                                                                                                                                                                                                                    | 5    |
| 8.7  | **Tests.** Every 2014 class built 1 → 20 on 2014 rules; snapshots and backups across rulesets.                                                                                                                                                                                                                                                                                                                                                                   | 2    |

**8B total: about 12 days.** **Checkpoint:** a group member's character with a 2014 subclass,
species or feat built and levelled; for 8B, a 2014-rules character too.

## 5. Phase 9: public release

### 5.1 What the public app is

**A free character sheet for D&D 2024 that comes with the free rules (the SRD) and imports content
you own.** That is the whole pitch, and it is the true one. The public version is described,
designed and promoted for exactly that, nothing more:

- **It ships the SRD 5.2.1**, which Wizards of the Coast released under CC-BY 4.0: enough to make
  a character of every class with no import at all.
- **Everything else is imported by the user** from content they own or have the right to use:
  their own homebrew, homebrew others publish, a pack their group made. The importer reads
  5etools-format JSON because that is the open format most homebrew is published in.
- **It hosts and links to no other content,** and neither does the repo.

What the release deliberately **does not** do, because a disclaimer does not protect a tool that
is built or promoted for infringing use (courts look at what a tool is designed and marketed for,
not only at its terms):

- no links to, instructions for, or hints toward downloading copies of paid books, in the app,
  the README, the repo or anywhere the app is promoted;
- no shipped or hosted packs other than the SRD;
- no wording in the app that suggests where to get books' data.

The importer stays as capable as it is; the public copy simply talks about the user's own
content, as above.

### 5.2 Steps

| Step | Work                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Est. |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 9.1  | **SRD spike (time-boxed).** Find CC-BY 4.0 structured conversions of SRD 5.2.1; check a sample (classes, subclasses, species, backgrounds, feats, spells, items) against the official PDF; choose one, or convert from the PDF ourselves.                                                                                                                                                                                                                       | 1    |
| 9.2  | **The SRD bundle.** A converter in `tools/srd/` to our pack format; the committed `public/srd/srd52.pack.json.gz`; a content-guard exception for exactly that file (path and checksum); `LICENSE-SRD.md` with the attribution CC-BY 4.0 requires.                                                                                                                                                                                                               | 4    |
| 9.3  | **First run.** The SRD loads on its own. The first screen says what is included (the free rules) and that more can be imported: a pack from your group, or your own homebrew.                                                                                                                                                                                                                                                                                   | 1    |
| 9.4  | **SRD and imported books side by side.** When a user imports a book that the SRD overlaps, the book's entity supersedes its SRD twin (matched by kind and name, with a rename map); characters built on the SRD keep working (refs resolve through the twin); phase 6 mappings on XPHB keys apply to SRD twins.                                                                                                                                                 | 2.5  |
| 9.5  | **Import copy for the public.** The Import screen and README talk about "your content": packs, homebrew files and links, and data folders in the 5etools JSON format (named as a format, with a link to the format's homebrew documentation, not to any book data). The developer smoke tests keep their `FIVETOOLS_DATA` variable; it is documented for contributors only.                                                                                     | 1    |
| 9.6  | **Legal and About.** In the app and the repo: not affiliated with or endorsed by Wizards of the Coast; the SRD attribution text exactly as CC-BY asks; the app ships only the SRD; imported content is the user's own responsibility and never leaves their device; trademarks belong to their owners; a contact for takedown requests. A privacy note: no accounts, no tracking, nothing sent anywhere. A licence for the code (MIT unless decided otherwise). | 1    |
| 9.7  | **Free, with an optional donation link.** No ads, no paid features, nothing behind a paywall. A "support the project" link (GitHub Sponsors or Ko-fi) in About only, for the work on the app, never tied to content. Check Wizards of the Coast's Fan Content Policy at release time for its current rules on donations and the use of its names, and follow it.                                                                                                | 0.5  |
| 9.8  | **Release readiness.** An error screen with "copy details"; versioned releases with a changelog; the update prompt (done); a README for players; the content guard also checks the built site; a last check that no commit in the history holds content.                                                                                                                                                                                                        | 1.5  |

**Phase 9 total: about 12.5 days.** 9.1 can run early as a spike; 9.4 is worth most once phase 6
mappings exist (they do). **Checkpoint:** someone outside the group installs it, starts with the
SRD, imports homebrew, and builds a character without help.

**Decisions needed before 9.6–9.7:** the public name (it must not use Wizards of the Coast's
trademarks as its own), the code licence, and the donation platform.

## 6. Cut, and why

- **Hiding and reordering tabs:** no player benefit worth its code.
- **Container compartments** (per-compartment weight): arithmetic for one item; the combined
  limit stays.
- **Full Wild Shape stat replacement:** the form's stat block beside what the druid keeps covers
  what a player needs.
- **Bastion mechanics** (turns, order outcomes, events): a Bastion is tracked and explained only.
- **The older optional encumbrance rule** (−10 ft. past 5 × Strength): not in the 2024 rules;
  added as an option only if the DM uses it.

## 7. Risks

- **Storage loss on iOS and Android.** Home Screen install, `persist()`, eviction detection,
  backups and reminders; a native shell or sync is the escape hatch if the group still loses data.
- **5etools format drift.** Import reports plus the smoke run on each data update; stable keys
  and reconciliation keep characters working.
- **2014 and homebrew content needing engine primitives the survey missed.** Mappings log gaps in
  `needs` (the coverage report lists them) instead of hacking around them.
- **Low-end phones.** Measured in an emulator only so far; the 7.10 checkpoint measures real ones.
- **Public release and content.** Covered by §5.1: the app ships and points to nothing but the
  SRD, and the content guard keeps the repo clean.

## 8. Verification

- `npm run typecheck && npm run lint && npm run format:check && npm test` green; CI runs these,
  the content guard and the build on every push, and deploys `main` to GitHub Pages.
- `FIVETOOLS_DATA=<5etools folder> npm run test:smoke`: opt-in, local, invariants only.
- Screens are checked on a phone-sized browser (Playwright) before merging, and on real phones at
  checkpoints.
