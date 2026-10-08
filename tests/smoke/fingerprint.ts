// A derived sheet in one line of numbers (plan §10.2, step 6.17): what a golden check compares.
// Armor Class, hit points, Proficiency Bonus, attacks per action, the first weapon's attack and
// damage, spell save DC, initiative and speed, saving throw proficiencies, spell slots, then
// each counter's maximum, a ward, the resistances and the switches. Names only, never text.

import type { DerivedSheet } from '../../src/engine/derive/types.ts';

const signed = (n: number) => (n < 0 ? `${n}` : `+${n}`);

export function fingerprint(s: DerivedSheet): string {
  const weapon = s.attacks.find((a) => a.kind === 'weapon' && a.ready) ?? s.attacks[0];
  const attack = weapon
    ? `${weapon.name} ${signed(weapon.toHit?.bonus.value ?? 0)} ${weapon.damageDice || '0'}${signed(weapon.damageBonus.value)}`
    : '-';
  const dc = Math.max(0, ...s.spellcasting.casters.map((c) => c.dc.value));
  const resources = s.resources.map((r) => `${r.name} ${r.max.value}${r.die ? ` ${r.die}` : ''}`);
  const resist = s.defenses.resistances.map((r) => r.value).sort();
  const saves = Object.entries(s.saves)
    .filter(([, r]) => r.proficiency !== 'none')
    .map(([a]) => a.toUpperCase());
  const pact = s.spellcasting.pact;
  const slots = [
    ...s.spellcasting.slots.map((x) => `${x.level}:${x.max}`),
    ...(pact ? [`pact ${pact.level}:${pact.max}`] : []),
  ];
  return [
    `AC ${s.ac.value} HP ${s.hp.max.value} PB ${signed(s.pb.value)} ×${s.attacksPerAction.value}`,
    attack,
    `DC ${dc || '-'} init ${signed(s.initiative.bonus.value)} speed ${s.speed.walk?.value ?? 0}`,
    `saves ${saves.join(' ')}${slots.length ? ` slots ${slots.join(' ')}` : ''}`,
    resources.join(', ') || 'no counters',
    s.hp.ward ? `ward ${s.hp.ward.max.value}` : '',
    resist.length ? `resist ${resist.join(' ')}` : '',
    s.toggles.length ? `switches ${s.toggles.map((t) => t.name).join(', ')}` : '',
  ]
    .filter(Boolean)
    .join(' | ');
}
