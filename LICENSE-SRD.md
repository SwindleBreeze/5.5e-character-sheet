# The free rules

The app ships the free rules of the fifth edition (2024) as one content pack,
`public/srd/srd52.pack.json.gz`, under the source code `SRD52`.

## Attribution

This work includes material from the System Reference Document 5.2 ("SRD 5.2") by Wizards of
the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is licensed under the
Creative Commons Attribution 4.0 International License, available at
https://creativecommons.org/licenses/by/4.0/legalcode.

## Where it comes from, and what was changed

The pack is converted from the SRD 5.2 compendium of the Foundry Virtual Tabletop dnd5e system
(https://github.com/foundryvtt/dnd5e, commit `93ba0dc3e837b66864ec385b8419882009b12e4e`),
whose SRD content is released under the same licence. `tools/srd/` holds the converter.

The material is changed in form only:

- It is rewritten into the app's own data format: text as the app's rich text, numbers and
  choices as data, class features by level, a Beast's attacks with their bonuses and damage
  worked out from its numbers.
- Entries are filed under the names the app files the same rules under elsewhere (for example
  "Bullseye Lantern" for "Lantern, Bullseye"); the SRD's own names are what the app shows.
- Links between entries point to the app's own entries; Foundry-only notes are left out.

The pack is licensed under CC-BY-4.0 as the SRD 5.2 is. Not affiliated with, endorsed, sponsored
or approved by Wizards of the Coast.
