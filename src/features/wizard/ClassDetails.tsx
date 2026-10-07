// What a class gives at a glance (plan §9.3, step 4.4): hit die, primary ability, saving throws,
// training, skills, starting equipment, and its table by level with the features gained.

import type { ContentIndex } from '../../engine/content/contentIndex.ts';
import { equipmentOptionText } from '../../engine/build/equipment.ts';
import { primaryText } from '../../engine/build/scores.ts';
import { ABILITY_NAMES, proficiencyBonus, type ClassDef } from '../../schema/index.ts';
import { InlineText } from '../../richtext/InlineText.tsx';
import { stripTags } from '../../richtext/tagRegistry.ts';
import { andList, armorText, skillChoiceText, toolText, weaponText } from './text.ts';
import styles from './wizard.module.css';

export function ClassFacts({ cls, index }: { cls: ClassDef; index: ContentIndex }) {
  const start = cls.startingProficiencies;
  return (
    <dl className={styles.facts}>
      <dt>Hit die</dt>
      <dd>
        d{cls.hitDie} (at level 1: {cls.hitDie} + your Constitution modifier hit points)
      </dd>
      <dt>Primary ability</dt>
      <dd>{primaryText(cls)}</dd>
      <dt>Saving throws</dt>
      <dd>{andList(cls.saves.map((a) => ABILITY_NAMES[a]))}</dd>
      <dt>Skills</dt>
      <dd>{skillChoiceText(cls)}</dd>
      <dt>Armor training</dt>
      <dd>{armorText(start.armor, index)}</dd>
      <dt>Weapons</dt>
      <dd>{weaponText(start.weapons, index)}</dd>
      <dt>Tools</dt>
      <dd>{toolText(start.tools, index)}</dd>
      {cls.startingEquipment.map((o) => (
        <div key={o.key} style={{ display: 'contents' }}>
          <dt>Equipment {o.key}</dt>
          <dd>{equipmentOptionText(o, index)}</dd>
        </div>
      ))}
    </dl>
  );
}

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
