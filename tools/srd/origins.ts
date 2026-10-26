// SRD species and backgrounds as 5etools records.
//
// A species is its traits as named entries, with its size, speed, senses, resistances, skills
// and spells. A species whose trait asks for a lineage, legacy or ancestry (Elven Lineage,
// Giant Ancestry) also gets one version per choice, filed as the 2024 Player's Handbook files
// them (`Elf; Drow Lineage`, `Dragonborn (Black)`), so each can be chosen as a species of its own.

import { baseItemName, startingEquipment } from './classes.ts';
import { TWIN, type Context } from './context.ts';
import type { Doc } from './foundry.ts';
import { SKILL, type Entry } from './html.ts';

const advancements = (doc: Doc): Doc[] => Object.values(doc.system?.advancement ?? {}) as Doc[];
const idOf = (uuid: string) => uuid.split('.').at(-1)!;
const SIZE: Record<string, string> = { tiny: 'T', sm: 'S', med: 'M', lg: 'L', huge: 'H', grg: 'G' };

/** Changes an entry's active effects make (`system.attributes.senses.ranges.darkvision`). */
function changes(doc: Doc): Record<string, number> {
  const out: Record<string, number> = {};
  for (const effect of (doc.effects ?? []) as Doc[]) {
    for (const c of (effect.system?.changes ?? effect.changes ?? []) as Doc[]) {
      const n = Number(c.value);
      if (Number.isFinite(n)) out[String(c.key)] = n;
    }
  }
  return out;
}

/** Spells an entry grants: cantrips and spells known, and spells cast once per rest. */
function spells(ctx: Context, docs: Doc[]): Doc | undefined {
  const known: Record<string, string[]> = {};
  const innate: Record<string, Doc> = {};
  let ability: string[] = [];
  for (const a of docs.flatMap(advancements)) {
    const spell = a.configuration?.spell;
    if (a.type !== 'ItemGrant' || !spell) continue;
    const level = String(Math.max(1, Number(a.level) || 1));
    if (spell.ability?.length) ability = spell.ability;
    for (const it of (a.configuration.items ?? []) as Doc[]) {
      const hit = ctx.byId.get(idOf(String(it.uuid)));
      if (hit?.pack !== 'spells24') continue;
      const name = `${String(hit.doc.name).toLowerCase()}|xphb`;
      const uses = String(spell.uses?.max ?? '');
      if (!uses) {
        (known[level] ??= []).push(Number(hit.doc.system?.level) === 0 ? `${name}#c` : name);
      } else {
        const per = uses === '@prof' ? 'pb' : uses;
        ((((innate[level] ??= { daily: {} }).daily as Doc)[per] ??= []) as string[]).push(name);
      }
    }
  }
  if (!Object.keys(known).length && !Object.keys(innate).length) return undefined;
  return {
    ...(ability.length ? { ability: ability.length > 1 ? { choose: ability } : ability[0] } : {}),
    ...(Object.keys(known).length ? { known } : {}),
    ...(Object.keys(innate).length ? { innate } : {}),
  };
}

/** Two grants of spells as one (Thaumaturgy from the species, the rest from a legacy). */
function mergeSpells(a: Doc | undefined, b: Doc | undefined): Doc | undefined {
  if (!a || !b) return a ?? b;
  const merge = (x: Doc = {}, y: Doc = {}) => {
    const out: Doc = { ...x };
    for (const [k, v] of Object.entries(y))
      out[k] = Array.isArray(v) ? [...(out[k] ?? []), ...v] : { ...out[k], ...v };
    return out;
  };
  return {
    ...((b.ability ?? a.ability) ? { ability: b.ability ?? a.ability } : {}),
    ...(a.known || b.known ? { known: merge(a.known, b.known) } : {}),
    ...(a.innate || b.innate ? { innate: merge(a.innate, b.innate) } : {}),
  };
}

const resistances = (docs: Doc[]) =>
  docs
    .flatMap(advancements)
    .filter((a) => a.type === 'Trait')
    .flatMap((a) =>
      ((a.configuration?.grants ?? []) as string[])
        .filter((g) => g.startsWith('dr:'))
        .map((g) => g.slice(3)),
    );

/** `Drow` → `Elf; Drow Lineage`; `Black Dragon Ancestor` → `Dragonborn (Black)`. */
function versionName(
  species: string,
  trait: string,
  option: string,
): { name: string; short: string } {
  if (species === 'Dragonborn') {
    const color = option.split(' ')[0]!;
    return { name: `Dragonborn (${color})`, short: color };
  }
  const paren = /\(([^)]+)\)/.exec(option)?.[1];
  const short = (paren ?? option).replace(/ Giant$/, '');
  const word = trait.split(' ').at(-1)!;
  return { name: `${species}; ${paren ?? option} ${word}`, short };
}

export function convertSpecies(ctx: Context, docs: Doc[]): Doc[] {
  return docs
    .filter((d) => d.type === 'race')
    .map((d) => {
      const sys = d.system;
      const adv = advancements(d);
      const traits = adv
        .filter((a) => a.type === 'ItemGrant')
        .sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
        .flatMap((a) =>
          ((a.configuration?.items ?? []) as Doc[]).map(
            (it) => ctx.byId.get(idOf(String(it.uuid)))?.doc,
          ),
        )
        .filter((t): t is Doc => !!t);
      const named = (t: Doc): Entry => ({
        type: 'entries',
        name: String(t.name),
        entries: ctx.entries(t.system?.description?.value),
      });

      // The trait that asks for a choice of lineage, legacy or ancestry, and its options.
      const choiceTrait = traits.find((t) =>
        advancements(t).some(
          (a) =>
            a.type === 'ItemChoice' &&
            (a.configuration?.pool ?? []).length &&
            a.configuration?.restriction?.subtype !== 'origin' &&
            a.configuration?.type !== 'spell',
        ),
      );
      const options = choiceTrait
        ? advancements(choiceTrait)
            .filter((a) => a.type === 'ItemChoice')
            .flatMap((a) =>
              (a.configuration.pool as Doc[]).map((p) => ctx.byId.get(idOf(String(p.uuid)))?.doc),
            )
            .filter((o): o is Doc => !!o)
        : [];

      const baseSpells = spells(ctx, traits);
      const speed = Number(sys.movement?.speeds?.walk) || 30;
      const darkvision = Number(sys.senses?.ranges?.darkvision) || 0;
      const resist = resistances(traits);
      const optionResists = options.map((o) => resistances([o]));
      const skills = traits
        .flatMap(advancements)
        .filter((a) => a.type === 'Trait')
        .flatMap((a) => (a.configuration?.choices ?? []) as Doc[])
        .filter((c) => String(c.pool?.[0] ?? '').startsWith('skills:'))
        .map((c) =>
          c.pool[0] === 'skills:*'
            ? { any: Number(c.count) || 1 }
            : {
                choose: { from: (c.pool as string[]).map((p) => SKILL[p.slice(7)]!.toLowerCase()) },
              },
        );
      const originFeat = traits
        .flatMap(advancements)
        .some((a) => a.type === 'ItemChoice' && a.configuration?.restriction?.subtype === 'origin');

      const record: Doc = {
        name: String(d.name),
        source: TWIN,
        edition: 'one',
        creatureTypes: [sys.type?.value ?? 'humanoid'],
        size: (adv.find((a) => a.type === 'Size')?.configuration?.sizes ?? ['med']).map(
          (s: string) => SIZE[s] ?? 'M',
        ),
        speed,
        ...(darkvision ? { darkvision } : {}),
        ...(resist.length
          ? { resist }
          : optionResists.some((r) => r.length)
            ? { resist: [{ choose: { from: [...new Set(optionResists.flat())] } }] }
            : {}),
        ...(traits.some((t) => t.name === 'Powerful Build')
          ? { traitTags: ['Powerful Build'] }
          : {}),
        ...(skills.length ? { skillProficiencies: skills } : {}),
        ...(originFeat ? { feats: [{ anyFromCategory: { category: ['O'], count: 1 } }] } : {}),
        entries: traits.map(named),
      };
      const optionSpells = options.map((o) => mergeSpells(baseSpells, spells(ctx, [o])));
      if (optionSpells.some(Boolean)) {
        record.additionalSpells = options.flatMap((o, i) =>
          optionSpells[i]
            ? [
                {
                  name: versionName(record.name, String(choiceTrait!.name), String(o.name)).short,
                  ...optionSpells[i],
                },
              ]
            : [],
        );
      } else if (baseSpells) {
        record.additionalSpells = [baseSpells];
      }

      if (choiceTrait && options.length) {
        const intro = ctx
          .entries(choiceTrait.system?.description?.value)
          .filter((e) => !(typeof e === 'object' && (e.type === 'table' || e.type === 'entries')));
        record._versions = options.map((o, i) => {
          const { name, short } = versionName(
            record.name,
            String(choiceTrait.name),
            String(o.name),
          );
          const c = changes(o);
          const version: Doc = {
            name,
            source: TWIN,
            _mod: {
              entries: {
                mode: 'replaceArr',
                replace: String(choiceTrait.name),
                items: {
                  type: 'entries',
                  name: `${choiceTrait.name} (${short})`,
                  entries: [...intro, ...ctx.entries(o.system?.description?.value)],
                },
              },
            },
          };
          const dv = c['system.attributes.senses.ranges.darkvision'];
          if (dv) version.darkvision = dv;
          const walk = c['system.attributes.movement.speeds.walk'];
          if (walk) version.speed = walk;
          if (optionResists[i]!.length) version.resist = optionResists[i];
          if (optionSpells[i]) version.additionalSpells = [optionSpells[i]];
          return version;
        });
      }
      return record;
    });
}

const COUNT_TOOLS: Record<string, string> = {
  game: 'anyGamingSet',
  music: 'anyMusicalInstrument',
  art: 'anyArtisansTool',
};

export function convertBackgrounds(ctx: Context, docs: Doc[]): Doc[] {
  return docs
    .filter((d) => d.type === 'background')
    .map((d) => {
      const adv = advancements(d);
      const html = String(d.system?.description?.value ?? '');
      const asi = adv.find((a) => a.type === 'AbilityScoreImprovement');
      const from = ['str', 'dex', 'con', 'int', 'wis', 'cha'].filter(
        (a) => !(asi?.configuration?.locked ?? []).includes(a),
      );
      const grants = adv
        .filter((a) => a.type === 'Trait')
        .flatMap((a) => (a.configuration?.grants ?? []) as string[]);
      const toolChoices = adv
        .filter((a) => a.type === 'Trait')
        .flatMap((a) => (a.configuration?.choices ?? []) as Doc[])
        .filter((c) => String(c.pool?.[0] ?? '').startsWith('tool:'));
      const skills = grants
        .filter((g) => g.startsWith('skills:'))
        .map((g) => SKILL[g.slice(7)]!.toLowerCase());
      const tools = grants
        .filter((g) => g.startsWith('tool:'))
        .map((g) => baseItemName(ctx, g.split(':').at(-1)!, 'tool').toLowerCase());
      // The feat, with the spell list Magic Initiate is taken for: `Magic Initiate (Cleric)`.
      const featGrant = adv.find((a) => a.type === 'ItemGrant')?.configuration?.items?.[0];
      const feat = featGrant ? ctx.byId.get(idOf(String(featGrant.uuid)))?.doc : undefined;
      const featLine = /<strong>Feat:<\/strong>(.*?)<\/p>/s.exec(html)?.[1] ?? '';
      const list = /\((\w+)\)/.exec(featLine.replace(/@UUID\[[^\]]*\]/g, ''))?.[1];
      const featId = feat
        ? `${String(feat.name).toLowerCase()}${list ? `; ${list.toLowerCase()}` : ''}|xphb`
        : undefined;

      const equipment = startingEquipment(ctx, d);
      // The compendium leaves the gold of option A to the text: `…, 8 GP; or (B) 50 GP`.
      const gold = /(\d+)\s*GP;\s*or\s*\(B\)/.exec(html.replace(/<[^>]+>/g, ''));
      const a = equipment.defaultData[0]?.A as Doc[] | undefined;
      if (gold && a && !a.some((e) => 'value' in e)) a.push({ value: Number(gold[1]) * 100 });

      return {
        name: String(d.name),
        source: TWIN,
        edition: 'one',
        ability: [
          { choose: { weighted: { from, weights: [2, 1] } } },
          { choose: { weighted: { from, weights: [1, 1, 1] } } },
        ],
        ...(featId ? { feats: [{ [featId]: true }] } : {}),
        skillProficiencies: [Object.fromEntries(skills.map((s) => [s, true]))],
        toolProficiencies: [
          {
            ...Object.fromEntries(tools.map((t) => [t, true])),
            ...Object.fromEntries(
              toolChoices.flatMap((c) => {
                const kind = COUNT_TOOLS[String(c.pool[0]).split(':')[1]!];
                return kind ? [[kind, Number(c.count) || 1]] : [];
              }),
            ),
          },
        ],
        startingEquipment: equipment.defaultData,
        entries: ctx.entries(html),
      };
    });
}
