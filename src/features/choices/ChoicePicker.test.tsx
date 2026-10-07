import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ContentIndex } from '../../engine/content/contentIndex.ts';
import { createCatalog, type Catalog } from '../../engine/build/catalog.ts';
import { derive } from '../../engine/derive/derive.ts';
import { setPick } from '../../engine/play/features.ts';
import { decodeChoiceKey, type Character, type ContentEntity } from '../../schema/index.ts';
import { testCharacter } from '../../test/characters.ts';
import { fixtureContent } from '../../test/fixtureIndex.ts';
import { FIXTURE_FEATURE_EFFECTS } from '../../test/fixtureFeatureEffects.ts';
import { ChoicePicker } from './ChoicePicker.tsx';

let index: ContentIndex;
let catalog: Catalog;
beforeAll(async () => {
  const content = await fixtureContent();
  index = content.index;
  catalog = createCatalog(
    Object.values(content.entities).flat() as ContentEntity[],
    new Set(['TST']),
  );
});

let latest: Character;

/** One pick of a live character, saved on every tap (as in the wizard). */
function Harness({ initial, slot }: { initial: Character; slot: string }) {
  const [character, setCharacter] = useState(initial);
  const sheet = derive(character, index, { registry: FIXTURE_FEATURE_EFFECTS });
  const feature = sheet.features.find((f) => f.choices.some((c) => c.offer.key.slot === slot))!;
  const choice = feature.choices.find((c) => c.offer.key.slot === slot)!;
  return (
    <ChoicePicker
      choice={choice}
      ctx={{ character, sheet, catalog, index }}
      instant
      onSave={(pick) => {
        latest = setPick(character, decodeChoiceKey(choice.key), {
          ...pick,
          entryIndex: feature.entryIndex,
          via: 'creation',
        });
        setCharacter(latest);
      }}
    />
  );
}

const lorekeeper = () => testCharacter({ classes: [{ classId: 'lorekeeper|tst', levels: 1 }] });

describe('ChoicePicker', () => {
  it('saves every tap, keeps to the count, and lists spells with their level and school', async () => {
    const user = userEvent.setup();
    render(<Harness initial={lorekeeper()} slot="spellbook.1" />);
    expect(screen.getByText('0 of 5 chosen')).toBeInTheDocument();
    const ink = screen.getByRole('checkbox', { name: 'Ink Cloud' });
    expect(ink).toHaveAccessibleDescription('Level 1 · Conjuration');
    await user.click(ink);
    expect(screen.getByText('1 of 5 chosen')).toBeInTheDocument();
    expect(latest.log[0]?.choices[0]).toMatchObject({
      values: ['ink cloud|tst'],
      valueKinds: ['spell'],
      via: 'creation',
    });
    // Unpicking the last one removes the record.
    await user.click(screen.getByRole('checkbox', { name: 'Ink Cloud' }));
    expect(latest.log[0]?.choices).toEqual([]);
  });

  it('Ignore rules lists every spell, under its level, with filters for level, school and ritual', async () => {
    const user = userEvent.setup();
    render(<Harness initial={lorekeeper()} slot="cantrips.1" />);
    // The Lorekeeper list has one cantrip.
    const options = () =>
      screen.getAllByRole('checkbox').filter((c) => c.getAttribute('name')?.startsWith('choice'));
    expect(options()).toHaveLength(1);
    await user.click(screen.getByRole('checkbox', { name: 'Ignore rules' }));
    expect(screen.getByRole('heading', { name: '1st-level spells' })).toBeInTheDocument();
    const filters = within(screen.getByRole('group', { name: 'Filter spells' }));
    await user.click(filters.getByRole('button', { name: 'Ritual' }));
    expect(
      options().map((c) => c.getAttribute('aria-labelledby') ?? c.closest('label')?.textContent),
    ).toEqual(['Dim Lantern']);
    await user.click(filters.getByRole('button', { name: 'Ritual' }));
    await user.selectOptions(filters.getByRole('combobox', { name: 'School' }), 'evocation');
    expect(options()).toHaveLength(3);
    await user.click(filters.getByRole('button', { name: 'Level 3' }));
    expect(options().map((c) => c.closest('label')?.textContent)).toEqual(['Rolling Boom']);
  });
});
