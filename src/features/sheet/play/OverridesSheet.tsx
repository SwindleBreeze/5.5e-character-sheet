// The character's overrides in one place (plan §9.2, step 3.22): every number the player set
// by hand, with what it is and a way to go back to the computed value.

import { useState } from 'react';
import { setOverride } from '../../../engine/play/reducers.ts';
import { ABILITY_NAMES, type Ability, type OverrideKey } from '../../../schema/index.ts';
import { Button } from '../../../ui/Button.tsx';
import { titleCase } from '../components/format.ts';
import inventory from '../inventory/inventory.module.css';
import type { SheetBindings } from '../sheetBindings.ts';
import featureStyles from '../features/features.module.css';

/** What an override key stands for, in words. */
function overrideLabel(key: string, bindings: SheetBindings): string {
  const [kind, rest = ''] = key.split('.');
  const ability = ABILITY_NAMES[rest as Ability];
  const caster = bindings.sheet.spellcasting.casters.find((c) => c.key === rest)?.name ?? rest;
  // `attack.<id>.toHit`: the id itself may hold dots.
  const attack = bindings.sheet.attacks.find((a) => a.id === key.slice(7, key.lastIndexOf('.')));
  switch (kind) {
    case 'score':
      return `${ability ?? rest} score`;
    case 'save':
      return `${ability ?? rest} saving throw`;
    case 'skill':
      return titleCase(rest);
    case 'passive':
      return `Passive ${titleCase(rest)}`;
    case 'ac':
      return 'Armor Class';
    case 'initiative':
      return 'Initiative';
    case 'speed':
      return `Speed (${rest})`;
    case 'hpMax':
      return 'Hit Point maximum';
    case 'pb':
      return 'Proficiency Bonus';
    case 'spellDc':
      return `Spell save DC (${caster})`;
    case 'spellAttack':
      return `Spell attack (${caster})`;
    case 'attack':
      return `${attack?.name ?? 'Attack'}: ${key.endsWith('.toHit') ? 'to hit' : 'damage'}`;
    default:
      return key;
  }
}

export function OverridesSheet({ bindings }: { bindings: SheetBindings }) {
  const { character, apply } = bindings;
  // The sheet shows the character as it was when opened: removals are tracked here.
  const [removed, setRemoved] = useState<string[]>([]);
  const entries = Object.entries(character.overrides).filter(([k]) => !removed.includes(k));
  if (!entries.length) {
    return (
      <p className={inventory.muted}>
        No overrides. To set one, tap a number on the sheet and type your own value; it shows a mark
        wherever the number appears.
      </p>
    );
  }
  return (
    <div className={inventory.form}>
      <p className={inventory.muted}>
        Numbers you set by hand. They replace what the sheet works out until you remove them.
      </p>
      <ul className={featureStyles.options} aria-label="Overrides">
        {entries.map(([key, value]) => (
          <li key={key} className={featureStyles.option}>
            <span>
              {overrideLabel(key, bindings)}: <strong className="numeric">{String(value)}</strong>
            </span>
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Remove the override of ${overrideLabel(key, bindings)}`}
              onClick={() => {
                setRemoved([...removed, key]);
                apply((c) => setOverride(c, key as OverrideKey, undefined));
              }}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
