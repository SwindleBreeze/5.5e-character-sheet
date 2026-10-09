// The Description tab (plan §9.2, step 3.21): name, portrait, size, alignment, god, the
// character's appearance, personality and history, and from level 5 a Bastion (step 7.7).
// Nothing here changes a number on the sheet.

import { useRef, useState, type ReactNode } from 'react';
import { SIZE_NAMES } from '../../engine/items/items.ts';
import {
  setDeity,
  setDetail,
  setName,
  setPortrait,
  type TextDetail,
} from '../../engine/play/details.ts';
import { showsBastion } from '../../engine/play/bastion.ts';
import { repos } from '../../db/repos.ts';
import { EntitySheet } from '../../richtext/EntitySheet.tsx';
import { Button } from '../../ui/Button.tsx';
import { useSheet } from '../../ui/sheetContext.ts';
import { columnsFor, useContainerWidth } from '../../ui/useContainerWidth.ts';
import { SectionHeader } from './components/stats.tsx';
import { BastionCard } from './description/BastionCard.tsx';
import { DeitySheet } from './description/DeitySheet.tsx';
import { shrinkImage, usePortraitUrl } from './description/portrait.ts';
import styles from './description/description.module.css';
import { LiveChoiceSheet } from '../choices/LiveChoiceSheet.tsx';
import inventory from './inventory/inventory.module.css';
import mainStyles from './MainTab.module.css';
import { usePublishBindings } from './liveBindings.ts';
import type { SheetBindings } from './sheetBindings.ts';
import { characterSources } from '../../sources/sourceFilter.ts';

/** The nine alignments (2024 Player's Handbook). */
const ALIGNMENTS = [
  'Lawful Good',
  'Neutral Good',
  'Chaotic Good',
  'Lawful Neutral',
  'Neutral',
  'Chaotic Neutral',
  'Lawful Evil',
  'Neutral Evil',
  'Chaotic Evil',
];

const TEXT_FIELDS: { key: TextDetail; label: string; rows: number }[] = [
  { key: 'appearance', label: 'Appearance', rows: 3 },
  { key: 'personality', label: 'Personality', rows: 3 },
  { key: 'ideals', label: 'Ideals', rows: 2 },
  { key: 'bonds', label: 'Bonds', rows: 2 },
  { key: 'flaws', label: 'Flaws', rows: 2 },
  { key: 'backstory', label: 'Backstory', rows: 6 },
  { key: 'allies', label: 'Allies and organizations', rows: 3 },
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className={mainStyles.section} aria-labelledby={`description-${id}`}>
      <SectionHeader id={`description-${id}`} title={title} />
      {children}
    </section>
  );
}

export function DescriptionTab(bindings: SheetBindings) {
  const { character, sheet, apply } = bindings;
  usePublishBindings(bindings);
  const ref = useRef<HTMLDivElement>(null);
  const columns = Math.min(2, columnsFor(useContainerWidth(ref)));
  const ui = useSheet();
  const portrait = usePortraitUrl(character.portraitId);
  const [busy, setBusy] = useState(false);
  const details = character.details;
  const deity = details.deity;

  const species = sheet.features.find((f) => f.group === 'species');
  const sizeChoice = species?.choices.find((c) => c.offer.key.slot === 'size');

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const id = await repos().characters.putPortrait(
        await shrinkImage(file),
        character.portraitId,
      );
      apply((c) => setPortrait(c, id));
    } finally {
      setBusy(false);
    }
  };
  const removePortrait = async () => {
    if (character.portraitId) await repos().characters.removePortrait(character.portraitId);
    apply((c) => setPortrait(c, null));
  };

  const chooseSize = () =>
    sizeChoice &&
    species &&
    ui.open({
      key: `choice:${sizeChoice.key}`,
      title: `Size: ${species.name}`,
      render: () => (
        <LiveChoiceSheet bindings={bindings} choiceKey={sizeChoice.key} onClose={ui.close} />
      ),
    });

  const chooseDeity = () =>
    ui.open({
      key: 'description:deity',
      title: 'Choose a god',
      render: () => (
        <DeitySheet
          current={deity}
          sources={characterSources(character)}
          onPick={(d) => {
            ui.close();
            apply((c) => setDeity(c, d));
          }}
        />
      ),
    });

  const alignments =
    details.alignment && !ALIGNMENTS.includes(details.alignment)
      ? [...ALIGNMENTS, details.alignment]
      : ALIGNMENTS;

  const character_ = (
    <Section id="character" title="Character">
      <div className={inventory.card}>
        <label className={inventory.field}>
          <span className={inventory.fieldLabel}>Name</span>
          <input
            value={character.name}
            onChange={(e) => apply((c) => setName(c, e.target.value))}
          />
        </label>

        <div className={styles.portrait}>
          {portrait ? (
            <img src={portrait} alt={`Portrait of ${character.name}`} className={styles.image} />
          ) : (
            <div className={styles.placeholder} aria-hidden="true">
              {character.name.trim().charAt(0).toUpperCase() || '?'}
            </div>
          )}
          <div className={inventory.actions}>
            <label className={styles.upload} data-busy={busy}>
              <input
                type="file"
                accept="image/*"
                className="visually-hidden"
                onChange={(e) => {
                  void upload(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              {character.portraitId ? 'Change portrait' : 'Add a portrait'}
            </label>
            {character.portraitId && (
              <Button variant="ghost" onClick={() => void removePortrait()}>
                Remove portrait
              </Button>
            )}
          </div>
        </div>

        <div className={inventory.field}>
          <span className={inventory.fieldLabel}>Size</span>
          <span>
            {SIZE_NAMES[sheet.size]}
            {species && <span className={inventory.muted}> · from {species.name}</span>}
          </span>
          {sizeChoice && (
            <Button size="sm" variant="ghost" onClick={chooseSize} aria-label="Change size">
              Change
            </Button>
          )}
        </div>

        <label className={inventory.field}>
          <span className={inventory.fieldLabel}>Alignment</span>
          <select
            value={details.alignment ?? ''}
            onChange={(e) => apply((c) => setDetail(c, 'alignment', e.target.value))}
          >
            <option value="">None chosen</option>
            {alignments.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <p className={inventory.help}>
          Alignment is a guide to how your character acts; it has no rules of its own.
        </p>
      </div>
    </Section>
  );

  const faith = (
    <Section id="faith" title="God">
      <div className={inventory.card}>
        {deity ? (
          deity.ref ? (
            <EntitySheet entityRef={deity.ref} />
          ) : (
            <p>
              <strong>{deity.name}</strong>
            </p>
          )
        ) : (
          <p className={inventory.muted}>
            No god chosen. Your character can worship a god, or none.
          </p>
        )}
        <div className={inventory.actions}>
          <Button onClick={chooseDeity}>{deity ? 'Change god' : 'Choose a god'}</Button>
          {deity && (
            <Button variant="ghost" onClick={() => apply((c) => setDeity(c, null))}>
              Remove
            </Button>
          )}
        </div>
      </div>
    </Section>
  );

  const story = (
    <Section id="story" title="Personality and history">
      <div className={inventory.card}>
        {TEXT_FIELDS.map((f) => (
          <label key={f.key} className={styles.text}>
            <span className={inventory.fieldLabel}>{f.label}</span>
            <textarea
              rows={f.rows}
              value={details[f.key] ?? ''}
              onChange={(e) => apply((c) => setDetail(c, f.key, e.target.value))}
            />
          </label>
        ))}
      </div>
    </Section>
  );

  const bastion = showsBastion(character, sheet.charLevel) && (
    <Section id="bastion" title="Bastion">
      <BastionCard character={character} apply={apply} />
    </Section>
  );

  return (
    <div ref={ref} className={mainStyles.main} data-columns={columns}>
      {columns === 1 ? (
        <div className={mainStyles.column}>
          {character_}
          {faith}
          {story}
          {bastion}
        </div>
      ) : (
        <>
          <div className={mainStyles.column}>
            {character_}
            {faith}
            {bastion}
          </div>
          <div className={mainStyles.column}>{story}</div>
        </>
      )}
    </div>
  );
}
