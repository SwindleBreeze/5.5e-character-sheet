// The "Needs attention" sheet (plan §4.4, step 3.23): choices still to make, picks the content
// no longer fits, content that isn't loaded or has a newer printing, and broken rules, each
// with what can be done about it. Anything can be ignored until it changes.

import { useState, type ReactNode } from 'react';
import {
  attentionItems,
  removeRecord,
  setIgnored,
  updateToReprint,
  type AttentionItem,
} from '../../../engine/play/attention.ts';
import type { DerivedFeature, DerivedFeatureChoice } from '../../../engine/derive/types.ts';
import { refName } from '../../../engine/content/resolve.ts';
import { Button } from '../../../ui/Button.tsx';
import { useSheet } from '../../../ui/sheetContext.ts';
import { choiceTitle } from '../../choices/labels.ts';
import { LiveChoiceSheet } from '../../choices/LiveChoiceSheet.tsx';
import inventory from '../inventory/inventory.module.css';
import type { SheetBindings } from '../sheetBindings.ts';
import styles from './attention.module.css';

interface Shown {
  title: string;
  text: string;
  actions?: ReactNode;
}

export function AttentionSheet({ bindings }: { bindings: SheetBindings }) {
  const { character, sheet, index, apply } = bindings;
  const ui = useSheet();
  // The sheet shows the character as it was when opened: what was dealt with is tracked here.
  const [done, setDone] = useState<string[]>([]);
  const [ignored, setIgnoredKeys] = useState<string[]>(character.ui.ignoredAttention ?? []);
  const items = attentionItems(sheet, character, index).filter((i) => !done.includes(i.key));
  const name = (ref: Parameters<typeof refName>[2]) => refName(index, character.snapshots, ref);

  const choices = sheet.features.flatMap((f) => f.choices.map((c) => ({ c, f })));
  const choiceFor = (key: string) => choices.find((x) => x.c.key === key);
  const finish = (key: string) => setDone([...done, key]);

  const pick = (c: DerivedFeatureChoice, f: DerivedFeature) =>
    ui.push({
      key: `choice:${c.key}`,
      title: `${choiceTitle(c)}: ${f.name}`,
      render: () => <LiveChoiceSheet bindings={bindings} choiceKey={c.key} onClose={ui.close} />,
    });

  const describe = (item: AttentionItem): Shown => {
    const { pending: p, record: r, issue, reprint } = item;
    if (p) {
      const found = choiceFor(item.key.slice('pending:'.length));
      const more = `${p.count - p.have} more to pick.`;
      if (!found) {
        return {
          title: `${p.offer.source.name}: starting equipment`,
          text: 'Not chosen. Add the items on the Inventory tab.',
        };
      }
      return {
        title: `${p.offer.source.name}: ${choiceTitle(found.c)}`,
        text: more,
        actions: (
          <Button size="sm" variant="primary" onClick={() => pick(found.c, found.f)}>
            Choose
          </Button>
        ),
      };
    }
    if (reprint) {
      return {
        title: name(reprint.from),
        text: `Isn’t loaded, so the sheet uses its saved copy. ${reprint.name} is a newer printing of it, and is loaded.`,
        actions: (
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              finish(item.key);
              apply((c) => updateToReprint(c, reprint.from, reprint.to));
            }}
          >
            Use {reprint.name}
          </Button>
        ),
      };
    }
    if (r) {
      const owner = name(r.at.record.key.owner);
      const labels = r.at.record.labels.join(', ');
      const found = choiceFor(r.key);
      const change = found && (
        <Button size="sm" onClick={() => pick(found.c, found.f)}>
          Change
        </Button>
      );
      switch (r.status) {
        case 'ownerMissing':
          return {
            title: owner,
            text: `Isn’t loaded, so the sheet uses its saved copy (pick: ${labels || 'none'}). Import the source it comes from to read it in full.`,
          };
        case 'slotMissing':
          return {
            title: owner,
            text: `No longer offers this pick (${labels}), so it isn’t used.`,
            actions: (
              <Button
                size="sm"
                onClick={() => {
                  finish(item.key);
                  apply((c) => removeRecord(c, r.key));
                }}
              >
                Remove the pick
              </Button>
            ),
          };
        case 'countMismatch':
          return {
            title: owner,
            text: `${r.at.record.values.length} picked, but ${r.expected} allowed now; only the first ${r.expected} count.`,
            actions: change,
          };
        case 'valueInvalid': {
          const bad = r.at.record.values
            .map((v, i) => (r.invalid?.includes(v) ? (r.at.record.labels[i] ?? v) : undefined))
            .filter(Boolean)
            .join(', ');
          return {
            title: owner,
            text: `${bad} isn’t an option any more, so it isn’t used.`,
            actions: change,
          };
        }
        default:
          return { title: owner, text: r.status };
      }
    }
    return { title: issue!.severity === 'warn' ? 'Rules' : 'Note', text: issue!.message };
  };

  const toggleIgnored = (key: string, on: boolean) => {
    setIgnoredKeys(on ? [...ignored, key] : ignored.filter((k) => k !== key));
    apply((c) => setIgnored(c, key, on));
  };

  const row = (item: AttentionItem, isIgnored: boolean) => {
    const shown = describe(item);
    return (
      <li key={item.key} className={styles.item} data-severity={item.severity}>
        <span className={inventory.resultName}>{shown.title}</span>
        <span>{shown.text}</span>
        <span className={inventory.actions}>
          {!isIgnored && shown.actions}
          <Button size="sm" variant="ghost" onClick={() => toggleIgnored(item.key, !isIgnored)}>
            {isIgnored ? 'Show again' : 'Ignore'}
          </Button>
        </span>
      </li>
    );
  };

  const open = items.filter((i) => !ignored.includes(i.key));
  const hidden = items.filter((i) => ignored.includes(i.key));
  const groups: { title: string; list: AttentionItem[] }[] = [
    { title: 'Choices to make', list: open.filter((i) => i.pending) },
    { title: 'Picks to check', list: open.filter((i) => i.record) },
    { title: 'Content', list: open.filter((i) => i.reprint) },
    { title: 'Rules', list: open.filter((i) => i.issue) },
  ];

  return (
    <div className={inventory.form}>
      {!open.length && <p className={inventory.muted}>Nothing needs attention.</p>}
      {groups
        .filter((g) => g.list.length)
        .map((g) => (
          <section key={g.title}>
            <h3 className={inventory.fieldLabel}>{g.title}</h3>
            <ul className={styles.list} aria-label={g.title}>
              {g.list.map((i) => row(i, false))}
            </ul>
          </section>
        ))}
      {hidden.length > 0 && (
        <details>
          <summary>Ignored ({hidden.length})</summary>
          <ul className={styles.list} aria-label="Ignored">
            {hidden.map((i) => row(i, true))}
          </ul>
        </details>
      )}
    </div>
  );
}
