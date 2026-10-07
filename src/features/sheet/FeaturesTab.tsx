// The Features tab (plan §9.2, step 3.20): everything the character has, grouped by where it
// comes from (each class, its subclass, species, background, feats, options picked in a
// feature), each with its text, its picks and its counters; and the Gifts the DM gave.

import { useRef, useState, type ReactNode } from 'react';
import type { DerivedFeature, DerivedFeatureChoice } from '../../engine/derive/types.ts';
import { addGift, removeGift, setPick } from '../../engine/play/features.ts';
import { decodeChoiceKey, refKey } from '../../schema/index.ts';
import { Button } from '../../ui/Button.tsx';
import { useSheet } from '../../ui/sheetContext.ts';
import { columnsFor, useContainerWidth } from '../../ui/useContainerWidth.ts';
import { SectionHeader } from './components/stats.tsx';
import { AddGiftSheet } from './features/AddGiftSheet.tsx';
import { ChoiceSheet } from './features/ChoiceSheet.tsx';
import { FeatureRow } from './features/FeatureRow.tsx';
import { choiceTitle } from './features/labels.ts';
import type { SheetBindings } from './sheetBindings.ts';
import mainStyles from './MainTab.module.css';
import inventory from './inventory/inventory.module.css';

interface Group {
  id: string;
  title: string;
  features: DerivedFeature[];
}

const keyOf = (f: DerivedFeature) => `${refKey(f.ref)}${f.n === undefined ? '' : `@${f.n}`}`;

/** By the level they come at; otherwise in the order collected. */
const byLevel = (a: DerivedFeature, b: DerivedFeature) => (a.level ?? 0) - (b.level ?? 0);

function groupFeatures(bindings: SheetBindings, top: DerivedFeature[]): [Group[], Group[]] {
  const { sheet } = bindings;
  const classes: Group[] = [];
  sheet.classes.forEach((c, i) => {
    classes.push({
      id: `class-${i}`,
      title: `${c.name} ${c.level}`,
      features: top.filter((f) => f.group === 'class' && f.classId === c.classId).sort(byLevel),
    });
    const sub = top.filter((f) => f.group === 'subclass' && f.classId === c.classId);
    if (sub.length) {
      classes.push({
        id: `subclass-${i}`,
        title: `${c.subclassName ?? 'Subclass'} (${c.name})`,
        features: sub.sort(byLevel),
      });
    }
  });
  const rest: Group[] = [];
  const add = (id: string, title: string, features: DerivedFeature[]) => {
    if (features.length) rest.push({ id, title, features });
  };
  add(
    'species',
    'Species',
    top.filter((f) => f.group === 'species'),
  );
  add(
    'background',
    'Background',
    top.filter((f) => f.group === 'background'),
  );
  add(
    'feats',
    'Feats',
    top.filter((f) => f.group === 'feat'),
  );
  // Invocations, Metamagic and the like: one section per feature they were picked in.
  const options = top.filter((f) => f.group === 'optionalFeature');
  const sectionOf = (f: DerivedFeature) => f.pickedIn?.progression ?? f.pickedIn?.name ?? 'Options';
  [...new Set(options.map(sectionOf))].forEach((name, i) =>
    add(
      `options-${i}`,
      name,
      options.filter((f) => sectionOf(f) === name),
    ),
  );
  const known = new Set(sheet.classes.map((c) => c.classId));
  add(
    'other',
    'Other',
    top.filter(
      (f) =>
        f.group === 'other' ||
        ((f.group === 'class' || f.group === 'subclass') && !known.has(f.classId ?? '')),
    ),
  );
  return [classes, rest];
}

export function FeaturesTab(bindings: SheetBindings) {
  const { character, sheet, apply } = bindings;
  const ref = useRef<HTMLDivElement>(null);
  const columns = Math.min(2, columnsFor(useContainerWidth(ref)));
  const ui = useSheet();
  const [open, setOpen] = useState<string[]>([]);

  // A subclass's picks and counters go with its first feature when that has the same name
  // (Path of the Berserker), so the name isn't listed twice.
  const merged = new Map<DerivedFeature, DerivedFeature>();
  for (const s of sheet.features.filter((f) => f.ref.kind === 'subclass')) {
    const same = sheet.features.find(
      (f) => f.ref.kind === 'subclassFeature' && f.subclassId === s.ref.id && f.name === s.name,
    );
    if (same) merged.set(s, same);
  }
  const top = sheet.features.filter((f) => !f.parent && !merged.has(f));
  const nestedOf = (f: DerivedFeature) => [
    ...sheet.features.filter((x) => x.parent === refKey(f.ref)),
    ...[...merged].filter(([, into]) => into === f).map(([s]) => s),
  ];
  const gifts = top.filter((f) => f.group === 'gift');
  const [classGroups, otherGroups] = groupFeatures(bindings, top);

  const choose = (choice: DerivedFeatureChoice, feature: DerivedFeature) =>
    ui.open({
      key: `choice:${choice.key}`,
      title: `${choiceTitle(choice)}: ${feature.name}`,
      render: () => (
        <ChoiceSheet
          choice={choice}
          character={character}
          sheet={sheet}
          onSave={(spec) => {
            ui.close();
            apply((c) =>
              setPick(c, decodeChoiceKey(choice.key), { ...spec, entryIndex: feature.entryIndex }),
            );
          }}
        />
      ),
    });

  const openAddGift = () =>
    ui.open({
      key: 'features:addGift',
      title: 'Add a gift',
      render: () => (
        <AddGiftSheet
          have={new Set(gifts.map((g) => g.ref.id))}
          sources={character.enabledSources}
          onAdd={(gift) => {
            ui.close();
            apply((c) => addGift(c, { kind: 'reward', id: gift.id }, gift.name));
          }}
        />
      ),
    });

  const row = (f: DerivedFeature) => {
    const key = keyOf(f);
    return (
      <FeatureRow
        key={key}
        feature={f}
        nested={nestedOf(f)}
        bindings={bindings}
        open={open.includes(key)}
        onToggle={() =>
          setOpen(open.includes(key) ? open.filter((k) => k !== key) : [...open, key])
        }
        onChoose={choose}
        {...(f.grantKey ? { onRemove: () => apply((c) => removeGift(c, f.ref)) } : {})}
      />
    );
  };

  const section = (g: Group, action?: ReactNode) => (
    <section key={g.id} className={mainStyles.section} aria-labelledby={`features-${g.id}`}>
      <SectionHeader id={`features-${g.id}`} title={g.title} action={action} />
      {g.features.length ? (
        <ul className={inventory.list} aria-label={g.title}>
          {g.features.map(row)}
        </ul>
      ) : (
        <p className={inventory.muted}>
          {g.id === 'gifts'
            ? 'No gifts. When the DM gives you a charm, blessing or boon, add it here.'
            : 'Nothing here yet.'}
        </p>
      )}
    </section>
  );

  const giftSection = section(
    { id: 'gifts', title: 'Gifts', features: gifts },
    <Button size="sm" onClick={openAddGift}>
      Add gift
    </Button>,
  );

  return (
    <div ref={ref} className={mainStyles.main} data-columns={columns}>
      {columns === 1 ? (
        <div className={mainStyles.column}>
          {classGroups.map((g) => section(g))}
          {otherGroups.map((g) => section(g))}
          {giftSection}
        </div>
      ) : (
        <>
          <div className={mainStyles.column}>{classGroups.map((g) => section(g))}</div>
          <div className={mainStyles.column}>
            {otherGroups.map((g) => section(g))}
            {giftSection}
          </div>
        </>
      )}
    </div>
  );
}
