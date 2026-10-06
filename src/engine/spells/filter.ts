// The spell filter language (P11), shared with 5etools `choose` strings: `key=value;value|…`,
// every part must match, values within a part are alternatives.
//
//   level=0;1;2                 spell level
//   class=Wizard;Cleric         on that class's list (by name)
//   subclass=Fighter: Eldritch Knight   on that subclass's list (class name: short name)
//   school=V;E                  school code (or name)
//   source=EGW                  source
//   components & miscellaneous=ritual;concentration
//   spell attack=m;r            makes a melee or ranged spell attack
//
// An unknown key matches nothing, so a filter the app doesn't understand offers no spells
// rather than every spell.

import { SPELL_SCHOOLS, type Spell } from '../../schema/index.ts';

function className(id: string): string {
  return (id.split('|')[0] ?? id).toLowerCase();
}

/** `eldritch knight|fighter|xphb|xphb` → `fighter: eldritch knight`. */
function subclassName(id: string): string {
  const [shortName = '', cls = ''] = id.split('|');
  return `${cls}: ${shortName}`.toLowerCase();
}

function partMatches(spell: Spell, key: string, values: string[]): boolean {
  switch (key) {
    case 'level':
      return values.some((v) => Number(v) === spell.level);
    case 'class':
      return values.some((v) => spell.classIds.some((id) => className(id) === v));
    case 'subclass':
      return values.some((v) => spell.subclassIds.some((id) => subclassName(id) === v));
    case 'school':
      return values.some(
        (v) => spell.school.toLowerCase() === (SPELL_SCHOOLS[v.toUpperCase()] ?? v),
      );
    case 'source':
      return values.some((v) => spell.source.toLowerCase() === v);
    case 'components & miscellaneous':
      return values.some((v) =>
        v === 'ritual'
          ? spell.ritual
          : v === 'concentration'
            ? spell.duration.some((d) => d.concentration)
            : false,
      );
    case 'spell attack':
      return values.some(
        (v) => (v === 'm' && spell.attack === 'melee') || (v === 'r' && spell.attack === 'ranged'),
      );
    default:
      return false;
  }
}

export function matchesSpellFilter(spell: Spell, filter: string): boolean {
  for (const part of filter.split('|')) {
    if (!part.trim()) continue;
    const eq = part.indexOf('=');
    const key = (eq < 0 ? part : part.slice(0, eq)).trim().toLowerCase();
    const values = (eq < 0 ? '' : part.slice(eq + 1))
      .split(';')
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
    if (!partMatches(spell, key, values)) return false;
  }
  return true;
}

/** `level=1;2;3` for levels 1 to `max`. */
export function levelsUpTo(max: number, from = 1): string {
  const levels: number[] = [];
  for (let l = from; l <= max; l++) levels.push(l);
  return `level=${levels.join(';')}`;
}
