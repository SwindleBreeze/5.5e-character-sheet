// SRD equipment and magic items as 5etools records: mundane weapons, armor, shields and
// ammunition as base items (so magic variants apply to them), everything else as items, and the
// "+1, +2, or +3" entries as magic variants. Pack contents become the pack's contents, not items
// of their own. Mundane items are filed under their 2024 Player's Handbook twins, magic items
// under their 2024 Dungeon Master's Guide twins.

import { itemSource, twinName, type Context } from './context.ts';
import type { Doc } from './foundry.ts';
import type { Entry } from './html.ts';
import { tagDice } from './spells.ts';

const RARITY: Record<string, string> = {
  common: 'common',
  uncommon: 'uncommon',
  rare: 'rare',
  veryRare: 'very rare',
  legendary: 'legendary',
  artifact: 'artifact',
};

const DAMAGE: Record<string, string> = {
  acid: 'A',
  bludgeoning: 'B',
  cold: 'C',
  fire: 'F',
  force: 'O',
  lightning: 'L',
  necrotic: 'N',
  piercing: 'P',
  poison: 'I',
  psychic: 'Y',
  radiant: 'R',
  slashing: 'S',
  thunder: 'T',
};

const PROPERTY: Record<string, string> = {
  amm: 'A',
  fin: 'F',
  hvy: 'H',
  lgt: 'L',
  lod: 'LD',
  rch: 'R',
  spc: 'S',
  thr: 'T',
  two: '2H',
  ver: 'V',
};

const EQUIPMENT_TYPE: Record<string, string> = {
  light: 'LA',
  medium: 'MA',
  heavy: 'HA',
  shield: 'S',
  ring: 'RG',
  rod: 'RD',
  wand: 'WD',
  clothing: 'G',
  trinket: 'G',
};

const CONSUMABLE_TYPE: Record<string, string> = {
  potion: 'P',
  scroll: 'SC',
  food: 'FD',
  wand: 'WD',
  rod: 'RD',
  trinket: 'G',
  poison: 'G',
};

const TOOL_TYPE: Record<string, string> = { art: 'AT', music: 'INS', game: 'GS' };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Copper pieces from a Foundry price. */
function priceCp(price: Doc | undefined): number | undefined {
  const v = Number(price?.value);
  if (!v) return undefined;
  const per: Record<string, number> = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 };
  return Math.round(v * (per[price?.denomination] ?? 100));
}

function dice(d: Doc | undefined): string | undefined {
  if (!d?.number || !d.denomination) return undefined;
  return `${d.number}d${d.denomination}${d.bonus ? `+${d.bonus}` : ''}`;
}

/** Is this one of the "+1, +2, or +3" entries, made a magic variant per bonus? */
const PLUS = /^(Weapon|Armor|Shield|Ammunition), \+1, \+2, or \+3$/;

export interface ItemRecords {
  baseitem: Doc[];
  item: Doc[];
  itemGroup: Doc[];
  magicvariant: Doc[];
}

/** Folders that aren't items: traps, a deck's cards, and Foundry's own helpers. */
const NOT_ITEMS = /(^|\/)(traps|mysterious-deck-cards|supplemental)\//;

/** Where a document sits: its folder. */
const dirOf = (path: string) => path.split('/').slice(0, -1).join('/');

export function convertItems(ctx: Context, docs: (Doc & { _path: string })[]): ItemRecords {
  const out: ItemRecords = { baseitem: [], item: [], itemGroup: [], magicvariant: [] };
  // A container is a folder's `_container.yml`; what else is in that folder is inside it.
  const containerDirs = new Map(
    docs
      .filter((d) => d._path.endsWith('_container.yml'))
      .map((d) => [dirOf(d._path), String(d._id)]),
  );
  const parentOf = (d: Doc & { _path: string }) =>
    d.system?.container ??
    (d._path.endsWith('_container.yml') ? undefined : containerDirs.get(dirOf(d._path)));
  const contents = new Map<string, { name: string; quantity: number }[]>();
  for (const d of docs) {
    const parent = parentOf(d);
    if (!parent) continue;
    const list = contents.get(parent) ?? [];
    list.push({ name: String(d.name), quantity: Number(d.system?.quantity) || 1 });
    contents.set(parent, list);
  }
  const items = docs.filter(
    (d) =>
      !parentOf(d) &&
      !NOT_ITEMS.test(d._path) &&
      ['weapon', 'equipment', 'consumable', 'tool', 'loot', 'container'].includes(d.type),
  );
  // An entry the SRD lists twice, among the gear and among the magic items, is the magic one.
  const magicNames = new Set(
    items.filter((d) => RARITY[d.system?.rarity]).map((d) => twinName('item', String(d.name))),
  );
  const seen = new Set<string>();

  for (const d of items) {
    const sys = d.system ?? {};
    const name = String(d.name);
    const rarity = RARITY[sys.rarity] ?? '';
    const magic = !!rarity;
    const source = itemSource(d);
    if (!magic && magicNames.has(twinName('item', name)) && source !== 'XDMG') continue;
    const key = `${twinName('item', name)}|${source}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const entries: Entry[] = tagDice(ctx.entries(sys.description?.value));
    const plus = PLUS.exec(name);
    if (plus) {
      out.magicvariant.push(...plusVariants(plus[1]!, entries));
      continue;
    }
    // "Wand of the War Mage, +1, +2, or +3": one item per bonus.
    const tiers = /^(.+), \+1, \+2, or \+3$/.exec(name);
    if (tiers) {
      out.item.push(
        ...[1, 2, 3].map((n) => ({
          name: `+${n} ${tiers[1]}`,
          source,
          rarity: ['uncommon', 'rare', 'very rare'][n - 1],
          ...(sys.type?.value === 'wand' ? { type: 'WD' } : {}),
          ...(sys.attunement === 'required' ? { reqAttune: true } : {}),
          bonusSpellAttack: `+${n}`,
          entries,
        })),
      );
      continue;
    }
    // "Arcane Focus (Varies)": a group of the items its table lists.
    if (/\(Varies\)$/.test(name)) {
      const members = [...JSON.stringify(entries).matchAll(/\{@item ([^|}]+)\|(\w+)/g)].map(
        (m) => `${m[1]}|${m[2]}`,
      );
      if (members.length) {
        out.itemGroup.push({
          name: twinName('item', name),
          source,
          rarity: 'none',
          ...(d._path.includes('spellcasting-focuses') ? { type: 'SCF' } : {}),
          items: [...new Set(members)],
          entries,
        });
      }
      continue;
    }

    const r: Doc = {
      name: twinName('item', name),
      source,
      rarity: rarity || 'none',
      entries,
    };
    if (r.name !== name) r.srdName = name;
    const weight = Number(sys.weight?.value);
    if (weight) r.weight = weight;
    const value = priceCp(sys.price);
    if (value) r.value = value;
    if (sys.attunement === 'required') r.reqAttune = true;

    let base = false;
    switch (d.type) {
      case 'weapon': {
        const t = String(sys.type?.value ?? '');
        if (!/^(simple|martial)[MR]$/.test(t)) {
          if (t === 'natural') continue;
          r.weapon = true;
          break;
        }
        r.type = t.endsWith('R') ? 'R' : 'M';
        r.weaponCategory = t.startsWith('martial') ? 'martial' : 'simple';
        r.weapon = true;
        const d1 = dice(sys.damage?.base);
        if (d1) r.dmg1 = d1;
        const type = sys.damage?.base?.types?.[0];
        if (type && DAMAGE[type]) r.dmgType = DAMAGE[type];
        const d2 = dice(sys.damage?.versatile);
        if (d2) r.dmg2 = d2;
        const props = ((sys.properties ?? []) as string[]).flatMap((p) =>
          PROPERTY[p] ? [`${PROPERTY[p]}|XPHB`] : [],
        );
        if (props.length) r.property = props;
        if (sys.range?.value) r.range = `${sys.range.value}/${sys.range.long ?? sys.range.value}`;
        if (sys.mastery) r.mastery = [`${cap(String(sys.mastery))}|XPHB`];
        if (sys.ammunition?.type) r.ammoType = `${ammoName(String(sys.ammunition.type))}|xphb`;
        if (sys.type?.baseItem && magic) r.baseItem = `${sys.type.baseItem}|xphb`;
        const bonus = Number(sys.magicalBonus);
        if (bonus) r.bonusWeapon = `+${bonus}`;
        base = !magic;
        break;
      }
      case 'equipment': {
        const t = String(sys.type?.value ?? '');
        if (EQUIPMENT_TYPE[t]) r.type = EQUIPMENT_TYPE[t];
        if (['light', 'medium', 'heavy'].includes(t)) {
          r.armor = true;
          if (sys.armor?.value) r.ac = Number(sys.armor.value);
          if (sys.strength) r.strength = String(sys.strength);
          if ((sys.properties ?? []).includes('stealthDisadvantage')) r.stealth = true;
          const bonus = Number(sys.armor?.magicalBonus ?? sys.magicalBonus);
          if (bonus) r.bonusAc = `+${bonus}`;
          base = !magic;
        } else if (t === 'shield') {
          r.ac = Number(sys.armor?.value) || 2;
          base = !magic;
        } else if (t === 'wondrous' || (!t && magic)) r.wondrous = true;
        break;
      }
      case 'consumable': {
        const t = String(sys.type?.value ?? '');
        if (t === 'ammo') {
          r.type = String(sys.type?.subtype) === 'firearmBullet' ? 'AF' : 'A';
          base = !magic;
          // Sold by the bundle ("Arrows", 20): one piece, and the bundle holding them.
          const count = Number(sys.quantity) || 1;
          const kind = sys.type?.subtype ? ammoName(String(sys.type.subtype)) : undefined;
          if (!magic && count > 1 && kind) {
            const single = kind.replace(/\b\w/g, (c) => c.toUpperCase());
            out.baseitem.push({
              name: single,
              source,
              rarity: 'none',
              type: r.type,
              ...(r.weight ? { weight: r.weight } : {}),
              ...(r.value ? { value: Math.round(Number(r.value) / count) } : {}),
              entries,
            });
            r.packContents = [{ item: `${kind}|xphb`, quantity: count }];
            if (r.weight) r.weight = Math.round(Number(r.weight) * count * 100) / 100;
          }
        } else if (CONSUMABLE_TYPE[t]) r.type = CONSUMABLE_TYPE[t];
        if (t === 'poison') r.poison = true;
        if (!magic && !r.type) r.type = 'G';
        break;
      }
      case 'tool':
        r.type = TOOL_TYPE[sys.type?.value] ?? 'T';
        if (r.type === 'T' && sys.type?.value) r.toolType = sys.type.value;
        break;
      case 'loot':
        r.type = 'G';
        break;
      case 'container': {
        if (!magic) r.type = 'G';
        else r.wondrous = true;
        if (sys.capacity?.type === 'weight' && sys.capacity.value) {
          r.containerCapacity = { weight: [Number(sys.capacity.value)] };
        }
        const inside = contents.get(String(d._id));
        if (inside?.length) {
          r.packContents = inside.map((c) => ({
            item: `${twinName('item', c.name).toLowerCase()}|xphb`,
            quantity: c.quantity,
          }));
        }
        break;
      }
    }
    // Light sources: their text points to the rules on light.
    if (!magic && JSON.stringify(entries).includes('{@variantrule Bright Light|')) r.light = [{}];
    // Charges.
    const max = Number(sys.uses?.max);
    const recovery = (sys.uses?.recovery ?? [])[0];
    if (max && magic) {
      r.charges = max;
      if (recovery?.period === 'dawn') {
        r.recharge = 'dawn';
        if (recovery.type === 'formula' && recovery.formula)
          r.rechargeAmount = `{@dice ${recovery.formula}}`;
      }
    }
    if (d._path.includes('spellcasting-focuses') && !magic) r.type = 'SCF';
    if (base) out.baseitem.push(r);
    else out.item.push(r);
  }
  return out;
}

/** Ammunition kinds as the items they are filed under. */
function ammoName(type: string): string {
  const names: Record<string, string> = {
    arrow: 'arrow',
    crossbowBolt: 'bolt',
    slingBullet: 'sling bullet',
    firearmBullet: 'firearm bullet',
    blowgunNeedle: 'needle',
  };
  return names[type] ?? type;
}

const PLUS_RARITY: Record<string, string[]> = {
  Weapon: ['uncommon', 'rare', 'very rare'],
  Armor: ['rare', 'very rare', 'legendary'],
  Shield: ['uncommon', 'rare', 'very rare'],
  Ammunition: ['uncommon', 'rare', 'very rare'],
};

/** "Weapon, +1, +2, or +3" → `+1 Weapon`, `+2 Weapon`, `+3 Weapon`, each for the items it fits. */
function plusVariants(kind: string, entries: Entry[]): Doc[] {
  const requires: Record<string, Doc[]> = {
    Weapon: [{ weapon: true }],
    Armor: [{ type: 'LA|XPHB' }, { type: 'MA|XPHB' }, { type: 'HA|XPHB' }],
    Shield: [{ type: 'S|XPHB' }],
    Ammunition: [{ type: 'A|XPHB' }, { type: 'AF|XDMG' }],
  };
  return [1, 2, 3].map((n) => ({
    name: `+${n} ${kind}`,
    source: 'XDMG',
    type: 'GV|XDMG',
    requires: requires[kind],
    ...(kind === 'Ammunition' ? { ammo: true } : {}),
    inherits: {
      namePrefix: `+${n} `,
      source: 'XDMG',
      rarity: PLUS_RARITY[kind]![n - 1],
      ...(kind === 'Armor' || kind === 'Shield' ? { bonusAc: `+${n}` } : { bonusWeapon: `+${n}` }),
      entries,
    },
  }));
}
