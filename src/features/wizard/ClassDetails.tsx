// A class's table by level (plan §9.3, step 4.4): proficiency bonus, the features gained, its
// columns and spell slots. What it gives at level 1 is `classBenefits` (§9.3b).

import type { ContentIndex } from '../../engine/content/contentIndex.ts';
import { proficiencyBonus, type ClassDef } from '../../schema/index.ts';
import { InlineText } from '../../richtext/InlineText.tsx';
import { stripTags } from '../../richtext/tagRegistry.ts';
import styles from './wizard.module.css';

export function ClassTable({ cls, index }: { cls: ClassDef; index: ContentIndex }) {
  const featuresAt = (level: number) =>
    cls.features
      .filter((f) => f.level === level)
      .map((f) => index.get({ kind: 'classFeature', id: f.featureId })?.name ?? '')
      .filter(Boolean);
  const slots = cls.slotTable;
  const slotLevels = slots
    ? Math.max(0, ...slots.map((row) => row.reduce((top, n, i) => (n > 0 ? i + 1 : top), 0)))
    : 0;
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table} aria-label={`${cls.name} table`}>
        <thead>
          <tr>
            <th className={styles.num}>Level</th>
            <th className={styles.num}>PB</th>
            <th>Features</th>
            {cls.table.map((c) => (
              <th key={c.key} className={styles.num}>
                {stripTags(c.label)}
              </th>
            ))}
            {Array.from({ length: slotLevels }, (_, i) => (
              <th key={`slot-${i}`} className={styles.num}>
                {i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 20 }, (_, i) => i + 1).map((level) => (
            <tr key={level}>
              <td className={styles.num}>{level}</td>
              <td className={styles.num}>+{proficiencyBonus(level)}</td>
              <td>{featuresAt(level).join(', ') || '—'}</td>
              {cls.table.map((c) => (
                <td key={c.key} className={styles.num}>
                  <InlineText text={String(c.values[level - 1] ?? '—')} />
                </td>
              ))}
              {Array.from({ length: slotLevels }, (_, s) => (
                <td key={`slot-${s}`} className={styles.num}>
                  {slots?.[level - 1]?.[s] || '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {slotLevels > 0 && (
        <p className={styles.intro}>The numbered columns are spell slots by spell level.</p>
      )}
    </div>
  );
}
