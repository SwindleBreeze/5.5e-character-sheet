// A derived sheet as plain text, one value per line with the parts that make it up, so golden
// snapshots read like a character sheet and their diffs show what changed and why
// (plan §9.2, step 3.12).

import { ABILITIES, SKILLS } from '../../../schema/index.ts';
import type {
  Contribution,
  Derived,
  DerivedAttack,
  DerivedOutcome,
  DerivedRoll,
  DerivedSheet,
  SourcedValue,
} from '../../derive/types.ts';

const signed = (n: number) => (n < 0 ? `${n}` : `+${n}`);

function part(p: Contribution): string {
  const value = p.kind === 'base' || p.kind === 'set' ? `${p.value}` : signed(p.value);
  return `${p.label} ${value}${p.kind === 'set' || p.kind === 'override' ? ` (${p.kind})` : ''}`;
}

const parts = (d: Derived) => (d.parts.length ? `  [${d.parts.map(part).join(', ')}]` : '');

function roll(r: DerivedRoll): string {
  const marks = [
    r.proficiency !== 'none' ? r.proficiency : '',
    r.mode !== 'normal' ? r.mode : '',
    ...r.dice.map((x) => `${x.dice} ${x.label}`),
    r.floor ? `min ${r.floor}` : '',
    ...r.advantage.map((a) => `adv: ${a}`),
    ...r.disadvantage.map((a) => `dis: ${a}`),
  ].filter(Boolean);
  return `${signed(r.bonus.value)}${marks.length ? ` (${marks.join('; ')})` : ''}${parts(r.bonus)}`;
}

function attackUse(a: DerivedAttack): string {
  if (a.use.kind === 'attackAction') return 'attack action';
  if (a.use.kind === 'lightExtra') return a.use.nick ? 'light extra (nick)' : 'light extra';
  return `cast (${a.use.time})`;
}

const sourced = (list: SourcedValue<string>[]) =>
  list.length ? list.map((v) => `${v.value} (${v.sources.join(', ')})`).join('; ') : '–';

function outcome(o: DerivedOutcome): string {
  if ('heal' in o) return `heal ${o.heal}`;
  if ('tempHp' in o) return `temp HP ${o.tempHp}`;
  if ('toggleOn' in o) return `toggle on ${o.toggleOn}`;
  if ('restore' in o) return `restore ${o.restore.amount} ${o.restore.label}`;
  return `regain slot ≤ ${o.regainSlot.maxLevel}`;
}

export function formatSheet(s: DerivedSheet): string {
  const out: string[] = [];
  const line = (text = '') => out.push(text);
  const head = (title: string) => {
    line();
    line(`## ${title}`);
  };

  line(
    `Level ${s.charLevel}: ${s.classes
      .map(
        (c) => `${c.name} ${c.level} (d${c.hitDie}${c.subclassName ? `, ${c.subclassName}` : ''})`,
      )
      .join(' / ')}; size ${s.size}`,
  );
  line(`Proficiency bonus ${signed(s.pb.value)}${parts(s.pb)}`);
  line(`AC ${s.ac.value} (${s.ac.calculation})${parts(s.ac)}`);
  line(`HP max ${s.hp.max.value}${parts(s.hp.max)}`);
  if (s.hp.ward) line(`${s.hp.ward.name} max ${s.hp.ward.max.value}${parts(s.hp.ward.max)}`);
  line(`Hit dice ${s.hitDice.map((h) => `${h.total}d${h.faces}`).join(' + ')}`);
  for (const [mode, d] of Object.entries(s.speed)) line(`Speed ${mode} ${d.value}${parts(d)}`);
  line(`Initiative ${roll(s.initiative)}`);
  line(`Concentration ${roll(s.concentration)}`);
  line(`Death saves ${roll(s.deathSave)}`);
  line(`Attacks per Attack action ${s.attacksPerAction.value}${parts(s.attacksPerAction)}`);
  const inv = s.inventory;
  line(
    `Carrying ${inv.weight.value} lb.${parts(inv.weight)} of ${inv.carry.value}${parts(inv.carry)}; drag ${inv.dragLiftPush}`,
  );
  line(`Attuned ${inv.attuned}/${inv.attunementMax}`);

  head('Abilities');
  for (const a of ABILITIES) {
    const ab = s.abilities[a];
    line(`${a} ${ab.score.value} (${signed(ab.mod)})${parts(ab.score)}`);
  }
  head('Saves and checks');
  for (const a of ABILITIES) line(`save ${a} ${roll(s.saves[a])}`);
  for (const a of ABILITIES) line(`check ${a} ${roll(s.checks[a])}`);
  head('Skills');
  for (const k of SKILLS) line(`${k} ${roll(s.skills[k])}`);
  for (const [k, d] of Object.entries(s.passives)) line(`passive ${k} ${d.value}${parts(d)}`);

  head('Proficiencies and defenses');
  line(`armor: ${sourced(s.proficiencies.armor)}`);
  line(`weapons: ${sourced(s.proficiencies.weapons)}`);
  line(`tools: ${sourced(s.proficiencies.tools)}`);
  line(`languages: ${sourced(s.proficiencies.languages)}`);
  line(`masteries: ${sourced(s.masteries)}`);
  line(`resistances: ${sourced(s.defenses.resistances)}`);
  line(`immunities: ${sourced(s.defenses.immunities)}`);
  line(`condition immunities: ${sourced(s.defenses.conditionImmunities)}`);
  line(
    `senses: ${s.senses.length ? s.senses.map((x) => `${x.value.sense} ${x.value.range} ft. (${x.sources.join(', ')})`).join('; ') : '–'}`,
  );

  head('Attacks');
  for (const a of s.attacks) {
    line(
      `${a.name} [${a.id}] ${attackUse(a)}, ${a.ready ? 'ready' : 'stowed'}, ${a.range} ${a.distance}, ${a.ability}${a.proficient ? ', proficient' : ''}, crit ${a.critRange}${a.mastery ? `, mastery ${a.mastery.name}` : ''}`,
    );
    if (a.toHit) line(`  to hit ${roll(a.toHit)}`);
    if (a.save) line(`  save ${a.save.ability} DC ${a.save.dc.value}${parts(a.save.dc)}`);
    if (a.grapple)
      line(
        `  grapple/shove DC ${a.grapple.dc.value}${a.grapple.freeHand ? '' : ', no free hand'}${parts(a.grapple.dc)}`,
      );
    line(
      `  damage ${a.damageDice || '–'} ${signed(a.damageBonus.value)} ${a.damageType}${a.versatileDice ? `, versatile ${a.versatileDice}` : ''}${parts(a.damageBonus)}`,
    );
    for (const r of a.riders) {
      line(
        `  rider ${r.name} ${r.dice}${r.damageType ? ` ${r.damageType}` : ''}${r.optIn ? ', opt-in' : ''}${r.oncePerTurn ? ', once per turn' : ''}${r.cost ? `, costs ${r.cost.label}` : ''}`,
      );
    }
    if (a.notes.length) line(`  notes: ${a.notes.join(', ')}`);
  }

  const sc = s.spellcasting;
  if (sc.casters.length || sc.granted.length || sc.slots.length || sc.pact) {
    head('Spellcasting');
    for (const c of sc.casters) {
      line(
        `${c.name} [${c.key}] level ${c.level}, ${c.progression}, ${c.ability}, prepares on ${c.preparedChange}, up to spell level ${c.maxSpellLevel}`,
      );
      line(`  DC ${c.dc.value}${parts(c.dc)}`);
      line(`  attack ${roll(c.attack)}`);
      line(`  cantrips ${c.cantrips.length}/${c.cantripsMax}: ${c.cantrips.join(', ') || '–'}`);
      line(`  prepared ${c.prepared.length}/${c.preparedMax}: ${c.prepared.join(', ') || '–'}`);
      if (c.alwaysPrepared.length) line(`  always prepared: ${c.alwaysPrepared.join(', ')}`);
      if (c.spellbook) line(`  spellbook ${c.spellbook.length}: ${c.spellbook.join(', ')}`);
      line(`  list: ${[...c.list.filters, ...c.list.ids].join(' + ')}`);
    }
    if (sc.slots.length) line(`slots: ${sc.slots.map((x) => `${x.level}:${x.max}`).join(' ')}`);
    if (sc.pact) line(`pact slots: ${sc.pact.max} at level ${sc.pact.level}`);
    for (const g of sc.granted) {
      line(
        `granted ${g.spellId} (${g.mode}, ${g.sourceName}${g.ability ? `, ${g.ability}` : ''}${g.dc !== undefined ? `, DC ${g.dc}` : ''}${g.usesMax !== undefined ? `, ${g.usesMax} uses` : ''}${g.resourceKey ? `, costs ${g.cost} of ${g.resourceKey}` : ''})`,
      );
    }
  }

  if (s.resources.length) {
    head('Resources');
    for (const r of s.resources) {
      line(
        `${r.name} [${r.key}] max ${r.max.value}, ${r.recharge}${r.die ? `, die ${r.die}` : ''}${r.pool ? ', pool' : ''}${parts(r.max)}`,
      );
      for (const w of r.restoreWith) line(`  restore ${w.amount} by ${w.costs.join(' + ')}`);
    }
  }

  if (s.actions.length || s.toggles.length) {
    head('Actions');
    for (const a of s.actions) {
      const extras = [
        a.costs.length ? `costs ${a.costs.map((c) => c.label).join(' + ')}` : '',
        a.outcomes.length ? a.outcomes.map(outcome).join(', ') : '',
        a.attackIds.length ? `attacks ${a.attackIds.join(', ')}` : '',
        a.roll ? `roll ${a.roll}` : '',
        a.saveDc !== undefined ? `DC ${a.saveDc}` : '',
      ].filter(Boolean);
      line(
        `${a.actionType}: ${a.name} (${a.sourceName})${extras.length ? `; ${extras.join('; ')}` : ''}`,
      );
    }
    for (const t of s.toggles) {
      const extras = [
        t.options.length ? `options ${t.options.map((o) => o.name).join(', ')}` : '',
        t.costs.length ? `costs ${t.costs.map((c) => c.label).join(' + ')}` : '',
        t.onActivate.length ? `on ${t.onActivate.map(outcome).join(', ')}` : '',
        t.group ? `group ${t.group}` : '',
        t.endsOn.length ? `ends on ${t.endsOn.join(', ')}` : '',
      ].filter(Boolean);
      line(
        `toggle: ${t.name} ${t.active ? 'on' : 'off'} (${t.sourceName})${extras.length ? `; ${extras.join('; ')}` : ''}`,
      );
    }
  }

  head('Features');
  for (const f of s.features) {
    const extras = [
      f.level !== undefined ? `level ${f.level}` : '',
      f.parent ? `in ${f.parent}` : '',
      f.pickedIn
        ? `from ${f.pickedIn.name}${f.pickedIn.progression ? ` (${f.pickedIn.progression})` : ''}`
        : '',
      `entry ${f.entryIndex}`,
      ...f.choices.map(
        (c) =>
          `${c.offer.key.slot}${c.progression ? ` [${c.progression.name}]` : ''} ${c.values.length}/${c.count}${c.offer.retrain ? ` (${c.offer.retrain})` : ''}`,
      ),
      ...f.resourceKeys.map((k) => `counter ${k}`),
    ].filter(Boolean);
    line(`${f.group}: ${f.name}; ${extras.join('; ')}`);
  }

  head('Choices and issues');
  for (const p of s.choices.pending) {
    line(`pending ${p.offer.source.name} ${p.offer.key.slot} ${p.have}/${p.count}`);
  }
  for (const r of s.choices.attention) line(`attention ${r.key} ${r.status}`);
  for (const i of s.issues) line(`${i.severity} ${i.code}: ${i.message}`);
  if (!s.choices.pending.length && !s.choices.attention.length && !s.issues.length) line('none');
  line();
  return out.join('\n');
}
