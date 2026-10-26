# The SRD converter

Builds the free rules pack the app ships (`public/srd/srd52.pack.json.gz`, plan 9.1–9.4) from
the SRD 5.2 compendium of the Foundry VTT dnd5e system.

```sh
git clone https://github.com/foundryvtt/dnd5e /tmp/dnd5e
git -C /tmp/dnd5e checkout 93ba0dc3e837b66864ec385b8419882009b12e4e
node tools/srd/build.ts /tmp/dnd5e
```

Keep the clone outside the repo. The build prints:

- the counts per kind;
- the pack's SHA-256: put it in `ALLOWED_CONTENT` (`scripts/content-guard-core.mjs`), or the
  content guard fails;
- the converted entries the compendium leaves without its `CC-BY-4.0` mark, to check against
  the SRD itself before shipping.

Rebuild when `ADAPTER_VERSION` goes up (`src/content/srdBundle.test.ts` fails until you do), or
to move to a newer commit of the compendium (update it here and in `LICENSE-SRD.md`).

## How it works

Each converter turns compendium entries (YAML, rich text in HTML with Foundry's own markup) into
5etools-format records, which the app's own homebrew importer then reads:

| File           | What                                                                     |
| -------------- | ------------------------------------------------------------------------ |
| `foundry.ts`   | Reads the packs and journals.                                            |
| `html.ts`      | Rich text and Foundry markup (links, rolls, embeds) as entries and tags. |
| `context.ts`   | Entries by id, links between them, and the names they are filed under.   |
| `spells.ts`    | Spells, with their class lists.                                          |
| `items.ts`     | Equipment and magic items.                                               |
| `classes.ts`   | Classes, subclasses, their features, invocations and Metamagic.          |
| `origins.ts`   | Species (with a version per lineage) and backgrounds.                    |
| `feats.ts`     | Feats.                                                                   |
| `rules.ts`     | The rules glossary, skills, languages, weapon and mastery properties.    |
| `creatures.ts` | Beasts, with attacks worked out from each creature's numbers.            |
| `build.ts`     | Runs them all, imports the records and writes the pack.                  |

SRD entries are filed under the ids of their twins in the 2024 books (`rage|barbarian|xphb|1|xphb`,
`ape|xmm`). The app's feature mappings, written for those books, then apply to the SRD as they
are, and importing a book replaces the SRD entries it covers in place. Where the SRD names an
entry differently, `RENAMES` in `context.ts` gives the name its twin is filed under; the SRD's
own name is still what the app shows. A name is mapped only when it differs in style; an SRD
spell renamed because its original name isn't free keeps the SRD's name.

To check the ids against a local data folder of the 2024 books (developers only), compare the
pack's ids with those the app's importer makes from that folder: entries with no twin there are
the ones to look at.
