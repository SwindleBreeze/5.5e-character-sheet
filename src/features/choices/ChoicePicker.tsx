// The choice picker (plan §9.3, step 4.3): one pick a character's content offers, whatever its
// kind. It shows how many to pick and enforces it, lists the options under their headings with a
// detail line (a spell's level and school, a weapon's kind, a feat's prerequisite), lets entity
// options be read in place, and narrows long spell lists by level, school and ritual. Rules guide,
// never block (plan §9.1): "Ignore rules" lists everything of the kind, lifts the count and lets
// a value the character already has, or whose prerequisites it doesn't meet, be picked.
//
// It writes through `onSave` (the caller records it with `setPick`): with a Save button in a
// sheet, or on every tap (`instant`) where the character is shown live, as in the wizard.

import { useId, useState, type ReactNode } from 'react';
import {
  offerOptions,
  type ChoiceOption,
  type OfferOptions,
} from '../../engine/choices/options.ts';
import type { AutoContext } from '../../engine/build/autoChoose.ts';
import type { DerivedFeatureChoice } from '../../engine/derive/types.ts';
import type { Spell } from '../../schema/index.ts';
import { EntitySheet } from '../../richtext/EntitySheet.tsx';
import { InlineText } from '../../richtext/InlineText.tsx';
import { Badge } from '../../ui/Badge.tsx';
import { Button } from '../../ui/Button.tsx';
import inventory from '../sheet/inventory/inventory.module.css';
import styles from './choices.module.css';
import { choiceHelp } from './help.ts';
import { isFreeSpread } from './spread.ts';
import { SpreadGrid } from './SpreadGrid.tsx';
import { suggestion } from './suggest.ts';
import { retrainText, type PickSave } from './picks.ts';

const SEARCH_FROM = 12;
const SPELL_FILTERS_FROM = 6;

/** Spell options narrowed by level, school and ritual (the spell filter DSL's parts). */
function useSpellFilter(options: ChoiceOption[], spells: Map<string, Spell>) {
  const [level, setLevel] = useState<number | null>(null);
  const [school, setSchool] = useState('');
  const [ritual, setRitual] = useState(false);
  const known = options.map((o) => spells.get(o.value)).filter((s) => s !== undefined);
  const levels = [...new Set(known.map((s) => s.level))].sort((a, b) => a - b);
  const schools = [...new Set(known.map((s) => s.school))].sort();
  const anyRitual = known.some((s) => s.ritual);
  const keep = (o: ChoiceOption) => {
    const s = spells.get(o.value);
    if (!s) return true;
    return (
      (level === null || s.level === level) &&
      (!school || s.school === school) &&
      (!ritual || s.ritual)
    );
  };
  const show = known.length >= SPELL_FILTERS_FROM && (levels.length > 1 || schools.length > 1);
  const controls = show ? (
    <div className={styles.filters} role="group" aria-label="Filter spells">
      {levels.length > 1 &&
        levels.map((l) => (
          <button
            key={l}
            type="button"
            className={styles.chip}
            aria-pressed={level === l}
            onClick={() => setLevel(level === l ? null : l)}
          >
            {l === 0 ? 'Cantrips' : `Level ${l}`}
          </button>
        ))}
      {schools.length > 1 && (
        <select aria-label="School" value={school} onChange={(e) => setSchool(e.target.value)}>
          <option value="">Any school</option>
          {schools.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      )}
      {anyRitual && (
        <button
          type="button"
          className={styles.chip}
          aria-pressed={ritual}
          onClick={() => setRitual(!ritual)}
        >
          Ritual
        </button>
      )}
    </div>
  ) : null;
  return { keep: show ? keep : () => true, controls };
}

export interface ChoicePickerProps {
  choice: DerivedFeatureChoice;
  ctx: AutoContext;
  onSave: (pick: PickSave) => void;
  /** Save every tap (the wizard, which shows the character live) instead of with Save. */
  instant?: boolean;
  /** Say when the rules let the pick change (the sheet; not while creating). */
  showRetrain?: boolean;
  /**
   * Shown under a picked option, right where it was picked: the picks the option brings with it
   * (an Ability Score Improvement's abilities).
   */
  under?: (value: string) => ReactNode;
}

export function ChoicePicker(props: ChoicePickerProps) {
  // Ability increases open to every ability: a grid, not fifty combinations (step 8.2).
  return isFreeSpread(props.choice) ? <SpreadGrid {...props} /> : <ListPicker {...props} />;
}

function ListPicker({ choice, ctx, onSave, instant, showRetrain, under }: ChoicePickerProps) {
  const [ignore, setIgnore] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[] | null>(null);
  // Read in place: a page pushed on the sheet would replace this one and lose the picks.
  const [reading, setReading] = useState<string | null>(null);

  const result: OfferOptions = offerOptions(choice.offer, ctx, choice.values, {
    ignoreRules: ignore,
  });
  const { options, valueKind, joined, hint } = result;
  const help = choiceHelp(choice);
  const spells = new Map(
    valueKind === 'spell'
      ? options.flatMap((o) => {
          const s = ctx.index.get({ kind: 'spell', id: o.value });
          return s ? [[o.value, s] as const] : [];
        })
      : [],
  );
  const spellFilter = useSpellFilter(options, spells);

  const saved = joined ? (choice.values.length ? [choice.values.join()] : []) : choice.values;
  const picks = instant ? saved : (selected ?? saved);
  const count = joined ? 1 : choice.count;
  const single = joined || (count === 1 && !ignore);
  const full = !ignore && picks.length >= count;
  const q = query.trim().toLowerCase();
  const shown = options.filter(
    (o) =>
      (!q || o.label.toLowerCase().includes(q)) && (picks.includes(o.value) || spellFilter.keep(o)),
  );
  const ready = picks.length > 0 && (ignore || picks.length <= count);

  const toSave = (values: string[]): PickSave => {
    const split = joined ? (values[0]?.split(',') ?? []) : values;
    return {
      values: split,
      labels: joined ? split : values.map((v) => options.find((o) => o.value === v)?.label ?? v),
      ...(valueKind ? { valueKinds: [valueKind] } : {}),
    };
  };

  const change = (next: string[]) => {
    if (instant) onSave(toSave(next));
    else setSelected(next);
  };

  const flip = (value: string) => {
    if (picks.includes(value)) change(picks.filter((v) => v !== value));
    else if (single) change([value]);
    else if (!full) change([...picks, value]);
  };

  // Headings only when the options fall under more than one.
  const groups = [...new Set(shown.map((o) => o.group ?? ''))];
  const grouped = groups.length > 1;
  const name = `choice-${choice.key}`;
  const baseId = useId();

  const row = (o: ChoiceOption) => {
    const on = picks.includes(o.value);
    const ruled = !!o.taken || !!o.unmet?.length;
    const blocked = !on && ((ruled && !ignore) || (full && !single));
    const descId = `${baseId}-${options.indexOf(o)}`;
    const why = suggestion(choice.offer, o.value, ctx);
    const notes = [
      why && (
        <span key="why" className={styles.why}>
          {why}
        </span>
      ),
      o.detail && (
        <span key="detail" className={styles.detail}>
          {o.detail}
        </span>
      ),
      o.summary && (
        <span key="summary" className={styles.about}>
          {o.summary}
          {o.more && <span className={styles.readHint}> {o.more}</span>}
        </span>
      ),
      o.about && (
        <span key="about" className={styles.about}>
          <strong>{o.about.title}</strong>
          {o.about.when && (
            <span className={styles.when}> ({o.about.when.toLowerCase()})</span>
          )}. <InlineText text={o.about.text} />
          {o.about.note && <> {o.about.note}</>}
        </span>
      ),
      o.unmet?.length && (
        <span key="unmet" className={styles.unmet}>
          Not met: {o.unmet.join(', ')}
        </span>
      ),
      o.unknown?.length && (
        <span key="unknown" className={styles.detail}>
          Check with your DM: {o.unknown.join(', ')}
        </span>
      ),
    ].filter(Boolean);
    return (
      <li key={o.value} className={styles.option}>
        <label className={styles.check}>
          <input
            type={single ? 'radio' : 'checkbox'}
            name={name}
            checked={on}
            aria-disabled={blocked}
            aria-describedby={notes.length ? descId : undefined}
            onChange={() => {
              if (!blocked) flip(o.value);
            }}
          />
          <span className={styles.label}>{o.label}</span>
        </label>
        {why && (
          <span className={styles.suggested} aria-hidden="true">
            Suggested
          </span>
        )}
        {o.taken && <Badge variant="warning">You have it already</Badge>}
        {valueKind && (
          <Button
            size="sm"
            variant="ghost"
            aria-label={`Read ${o.label}`}
            aria-expanded={reading === o.value}
            onClick={() => setReading(reading === o.value ? null : o.value)}
          >
            Read
          </Button>
        )}
        {notes.length > 0 && (
          <span id={descId} className={styles.text}>
            {/* Spaced, so a screen reader doesn't run the lines together. */}
            {notes.flatMap((n, i) => (i ? [' ', n] : [n]))}
          </span>
        )}
        {valueKind && reading === o.value && (
          <div className={styles.reading}>
            <EntitySheet entityRef={{ kind: valueKind, id: o.value }} />
          </div>
        )}
        {on && under && <div className={styles.under}>{under(o.value)}</div>}
      </li>
    );
  };

  return (
    <div className={styles.picker}>
      {help && <p className={styles.help}>{help}</p>}
      <div className={styles.head}>
        <span className={styles.count} aria-live="polite" data-done={picks.length >= count}>
          {joined ? (picks.length ? 'Chosen' : 'Choose one') : `${picks.length} of ${count} chosen`}
        </span>
        <label className={inventory.check}>
          <input type="checkbox" checked={ignore} onChange={(e) => setIgnore(e.target.checked)} />
          Ignore rules
        </label>
      </div>
      {hint && choice.offer.kind !== 'backgroundAbility' && <p className={styles.hint}>{hint}</p>}
      {showRetrain && (
        <p className={styles.hint}>
          {retrainText(choice)}
          {valueKind && choice.values.length > 0
            ? ' Choices you made for what you replace are removed with it.'
            : ''}
        </p>
      )}
      {ignore && (
        <p className={styles.hint}>
          Everything of this kind is listed, and any number can be picked.
        </p>
      )}
      {options.length > SEARCH_FROM && (
        <input
          type="search"
          className={inventory.search}
          aria-label="Find an option"
          placeholder="Find an option"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      {spellFilter.controls}
      {!options.length && (
        <p className={inventory.warn}>
          Nothing from your sources fits this choice. Check Settings → Sources, or import the source
          it comes from.
        </p>
      )}
      {grouped ? (
        <div className={styles.groups}>
          {groups.map((g) => (
            <section key={g} aria-label={g || 'Other'}>
              <h4 className={styles.groupTitle}>{g || 'Other'}</h4>
              <ul className={styles.options} aria-label={g || 'Other'}>
                {shown.filter((o) => (o.group ?? '') === g).map(row)}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <ul className={styles.options} aria-label="Options">
          {shown.map(row)}
        </ul>
      )}
      {!instant && (
        <div className={inventory.actions}>
          <Button
            variant="primary"
            aria-disabled={!ready}
            onClick={() => {
              if (ready) onSave(toSave(picks));
            }}
          >
            Save
          </Button>
        </div>
      )}
    </div>
  );
}
