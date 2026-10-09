// Adding a familiar, steed, companion or summon (step 7.6). The creatures this character's
// spells and classes summon come first, familiars when it has a familiar spell; any creature of
// the enabled sources can be found by name, or one written in by hand.

import { useMemo, useState } from 'react';
import { useEnabledSources, useEntitiesOfKind } from '../../../content/hooks.ts';
import type { DerivedSheet } from '../../../engine/derive/types.ts';
import { suggestedCreatures } from '../../../engine/extras/extras.ts';
import { creatureSubtitle } from '../../../richtext/entityMeta.ts';
import type { Character, Creature } from '../../../schema/index.ts';
import { availableOf } from '../../../sources/sourceFilter.ts';
import { Button } from '../../../ui/Button.tsx';
import inventory from '../inventory/inventory.module.css';

export interface AddExtraSpec {
  creature?: Creature;
  name?: string;
  spellLevel?: number;
  hpMax?: number;
}

const MAX_RESULTS = 50;
const SPELL_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const byName = (a: Creature, b: Creature) =>
  a.name.localeCompare(b.name) || a.source.localeCompare(b.source);

function Result({ creature, onPick }: { creature: Creature; onPick: () => void }) {
  return (
    <li>
      <button type="button" className={inventory.result} onClick={onPick}>
        <span className={inventory.resultName}>{creature.name}</span>
        <span className={inventory.muted}>
          {creatureSubtitle(creature)}
          {creature.cr !== undefined ? ` · CR ${creature.cr}` : ''} · {creature.source}
        </span>
      </button>
    </li>
  );
}

export function AddExtraSheet({
  character,
  sheet,
  onAdd,
}: {
  character: Character;
  sheet: DerivedSheet;
  onAdd: (spec: AddExtraSpec) => void;
}) {
  const all = useEntitiesOfKind('creature');
  const enabled = useEnabledSources(character.enabledSources);
  const [mode, setMode] = useState<'library' | 'custom'>('library');
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Creature | null>(null);
  const available = useMemo(() => availableOf(all ?? [], new Set(enabled)), [all, enabled]);
  const suggested = useMemo(
    () => suggestedCreatures(available, character, sheet),
    [available, character, sheet],
  );
  if (!all) return <p className={inventory.muted}>Loading creatures…</p>;

  const q = query.trim().toLowerCase();
  const results = q
    ? available
        .filter((c) => c.name.toLowerCase().includes(q))
        .sort(byName)
        .slice(0, MAX_RESULTS)
    : [];

  return (
    <div className={inventory.add}>
      <div className={inventory.segmented} role="group" aria-label="Where it comes from">
        <Button
          size="sm"
          variant={mode === 'library' ? 'primary' : 'ghost'}
          aria-pressed={mode === 'library'}
          onClick={() => setMode('library')}
        >
          From the library
        </Button>
        <Button
          size="sm"
          variant={mode === 'custom' ? 'primary' : 'ghost'}
          aria-pressed={mode === 'custom'}
          onClick={() => setMode('custom')}
        >
          Write one in
        </Button>
      </div>

      {mode === 'custom' ? (
        <CustomForm onAdd={onAdd} />
      ) : picked ? (
        <PickedForm creature={picked} onBack={() => setPicked(null)} onAdd={onAdd} />
      ) : (
        <>
          <input
            type="search"
            className={inventory.search}
            aria-label="Find a creature"
            placeholder="Find a creature"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {q ? (
            <>
              {!results.length && <p className={inventory.muted}>No creatures match.</p>}
              <ul className={inventory.results} aria-label="Creatures found">
                {results.map((c) => (
                  <Result key={c.id} creature={c} onPick={() => setPicked(c)} />
                ))}
              </ul>
            </>
          ) : suggested.length ? (
            <>
              <p className={inventory.muted}>From your spells and features:</p>
              <ul className={inventory.results} aria-label="Suggested creatures">
                {suggested.map((c) => (
                  <Result key={c.id} creature={c} onPick={() => setPicked(c)} />
                ))}
              </ul>
            </>
          ) : (
            <p className={inventory.muted}>
              {available.length
                ? `Search ${available.length} creatures from your sources: familiars, summons, companions and Beasts.`
                : 'Your sources have no creatures. Import the content again to add them.'}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function PickedForm({
  creature,
  onBack,
  onAdd,
}: {
  creature: Creature;
  onBack: () => void;
  onAdd: (spec: AddExtraSpec) => void;
}) {
  const minLevel = creature.summon?.spellId ? (creature.summon.spellLevel ?? 1) : undefined;
  const [name, setName] = useState(creature.name);
  const [level, setLevel] = useState(minLevel ?? 1);
  return (
    <form
      className={inventory.form}
      onSubmit={(e) => {
        e.preventDefault();
        onAdd({
          creature,
          name: name.trim() || creature.name,
          ...(minLevel !== undefined ? { spellLevel: level } : {}),
        });
      }}
    >
      <p>
        <strong>{creature.name}</strong>
        <br />
        <span className={inventory.muted}>
          {creatureSubtitle(creature)} · {creature.source}
        </span>
      </p>
      <label className={inventory.field}>
        <span className={inventory.fieldLabel}>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      {minLevel !== undefined && (
        <label className={inventory.field}>
          <span className={inventory.fieldLabel}>Spell level</span>
          <select value={level} onChange={(e) => setLevel(Number(e.target.value))}>
            {SPELL_LEVELS.filter((l) => l >= minLevel).map((l) => (
              <option key={l} value={l}>
                Level {l}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className={inventory.actions}>
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" variant="primary">
          Add
        </Button>
      </div>
    </form>
  );
}

function CustomForm({ onAdd }: { onAdd: (spec: AddExtraSpec) => void }) {
  const [name, setName] = useState('');
  const [hp, setHp] = useState('');
  const max = Math.floor(Number(hp));
  const ready = !!name.trim();
  return (
    <form
      className={inventory.form}
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) onAdd({ name, ...(max > 0 ? { hpMax: max } : {}) });
      }}
    >
      <label className={inventory.field}>
        <span className={inventory.fieldLabel}>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label className={inventory.field}>
        <span className={inventory.fieldLabel}>HP maximum</span>
        <input inputMode="numeric" value={hp} onChange={(e) => setHp(e.target.value)} />
      </label>
      <div className={inventory.actions}>
        <Button type="submit" variant="primary" aria-disabled={!ready}>
          Add
        </Button>
      </div>
    </form>
  );
}
