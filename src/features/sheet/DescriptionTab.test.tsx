import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../db/db.ts';
import { repos } from '../../db/repos.ts';
import type { ContentIndex } from '../../engine/content/contentIndex.ts';
import { derive } from '../../engine/derive/derive.ts';
import type { Character } from '../../schema/index.ts';
import { testCharacter } from '../../test/characters.ts';
import { FIXTURE_FEATURE_EFFECTS } from '../../test/fixtureFeatureEffects.ts';
import { fixtureIndex } from '../../test/fixtureIndex.ts';
import { seedFixtureContent } from '../../test/seedContent.ts';
import { SheetProvider } from '../../ui/BottomSheet.tsx';
import { RollerProvider } from '../../ui/Roller.tsx';
import { DescriptionTab } from './DescriptionTab.tsx';
import { NotesTab } from './NotesTab.tsx';
import type { SheetBindings } from './sheetBindings.ts';
import type { CharacterUpdate } from './useCharacterActions.ts';

let index: ContentIndex;
beforeAll(async () => {
  index = await fixtureIndex();
});
beforeEach(async () => {
  await resetDb('test-description');
  await seedFixtureContent(['TST']);
});

let latest: Character;

function Harness({
  initial,
  Tab,
}: {
  initial: Character;
  Tab: (b: SheetBindings) => React.ReactNode;
}) {
  const ref = useRef(initial);
  const [character, setCharacter] = useState(initial);
  const sheet = derive(character, index, { registry: FIXTURE_FEATURE_EFFECTS });
  const apply = (update: CharacterUpdate) => {
    ref.current = update(ref.current);
    latest = ref.current;
    setCharacter(ref.current);
  };
  return <Tab character={character} sheet={sheet} index={index} apply={apply} />;
}

const renderTab = (Tab: (b: SheetBindings) => React.ReactNode, c = character()) =>
  render(
    <RollerProvider>
      <SheetProvider>
        <Harness initial={c} Tab={Tab} />
      </SheetProvider>
    </RollerProvider>,
  );

/** A Brute 1 Mossling: Mosslings are Small or Medium, picked with the species. */
const character = () =>
  testCharacter({
    name: 'Ada',
    classes: [{ classId: 'brute|tst', levels: 1 }],
    speciesId: 'mossling|tst',
    backgroundId: 'arena hand|tst',
    choices: [{ owner: { kind: 'species', id: 'mossling|tst' }, slot: 'size', values: ['M'] }],
  });

const section = (name: string) => within(screen.getByRole('region', { name }));

describe('Description tab', () => {
  it('edits the name, alignment and the written details; shows the size and its pick', async () => {
    const user = userEvent.setup();
    renderTab(DescriptionTab);
    const name = screen.getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Bree');
    expect(latest.name).toBe('Bree');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Alignment' }), 'Chaotic Good');
    expect(latest.details.alignment).toBe('Chaotic Good');

    await user.type(screen.getByRole('textbox', { name: 'Backstory' }), 'Grew up in the arena.');
    expect(latest.details.backstory).toBe('Grew up in the arena.');

    const card = section('Character');
    expect(card.getByText('Medium')).toBeTruthy();
    expect(card.getByText(/from Mossling/)).toBeTruthy();
    await user.click(card.getByRole('button', { name: 'Change size' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(await dialog.findByRole('radio', { name: 'Small' }));
    await user.click(dialog.getByRole('button', { name: 'Save' }));
    expect(latest.log[0]!.choices[0]).toMatchObject({ values: ['S'], via: 'retrain' });
    expect(card.getByText('Small')).toBeTruthy();
  });

  it('chooses a god by pantheon, or one typed in, and removes it', async () => {
    const user = userEvent.setup();
    renderTab(DescriptionTab);
    const god = section('God');
    await user.click(god.getByRole('button', { name: 'Choose a god' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Choose a god' }));
    await user.selectOptions(
      await dialog.findByRole('combobox', { name: 'Pantheon' }),
      'Faerûnian',
    );
    expect(dialog.queryByRole('button', { name: 'Choose Brask' })).toBeNull();
    await user.type(dialog.getByRole('searchbox', { name: 'Find a god' }), 'light');
    await user.click(dialog.getByRole('button', { name: 'Choose Mirela' }));
    expect(latest.details.deity).toEqual({
      ref: { kind: 'deity', id: 'mirela|faerûnian|tst' },
      name: 'Mirela',
    });
    // Shown with its title, symbol and domains.
    expect(await god.findByText(/Goddess of dawn and second chances/i)).toBeTruthy();
    expect(god.getByText('A rising sun over a road')).toBeTruthy();

    await user.click(god.getByRole('button', { name: 'Change god' }));
    const again = within(await screen.findByRole('dialog', { name: 'Choose a god' }));
    await user.type(again.getByRole('textbox', { name: 'Or type a name' }), 'The Lantern');
    await user.click(again.getByRole('button', { name: 'Use this name' }));
    expect(latest.details.deity).toEqual({ name: 'The Lantern' });

    await user.click(god.getByRole('button', { name: 'Remove' }));
    expect(latest.details.deity).toBeUndefined();
  });

  it('stores a portrait and removes it', async () => {
    const user = userEvent.setup();
    renderTab(DescriptionTab);
    const file = new File(['png-bytes'], 'ada.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Add a portrait'), file);
    // (fake-indexeddb doesn't give a Blob back, so the image itself isn't shown here.)
    expect(await screen.findByText('Change portrait')).toBeTruthy();
    const id = latest.portraitId!;
    expect(await repos().characters.portrait(id)).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Remove portrait' }));
    expect(latest.portraitId).toBeUndefined();
    expect(await repos().characters.portrait(id)).toBeUndefined();
  });
});

describe('Notes tab', () => {
  it('free notes and a dated session log, newest first', async () => {
    const user = userEvent.setup();
    renderTab(NotesTab);
    await user.type(screen.getByRole('textbox', { name: 'Notes' }), 'Owes Garrick 5 GP.');
    expect(latest.notes).toBe('Owes Garrick 5 GP.');

    const form = section('Session log');
    const date = form.getByLabelText('Date');
    await user.clear(date);
    await user.type(date, '2026-10-01');
    await user.type(form.getByRole('textbox', { name: 'What happened' }), 'Met the guild.');
    await user.click(form.getByRole('button', { name: 'Add entry' }));
    await user.clear(date);
    await user.type(date, '2026-10-07');
    await user.type(form.getByRole('textbox', { name: 'What happened' }), 'Raided the crypt.');
    await user.click(form.getByRole('button', { name: 'Add entry' }));
    expect(latest.sessionLog.map((n) => [n.date, n.text])).toEqual([
      ['2026-10-01', 'Met the guild.'],
      ['2026-10-07', 'Raided the crypt.'],
    ]);
    const entries = within(screen.getByRole('list', { name: 'Session log entries' }));
    expect(entries.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      expect.stringContaining('Raided the crypt.'),
      expect.stringContaining('Met the guild.'),
    ]);

    const first = within(entries.getAllByRole('listitem')[1]!);
    await user.click(first.getByRole('button', { name: 'Edit' }));
    const text = first.getByRole('textbox', { name: 'What happened' });
    await user.clear(text);
    await user.type(text, 'Met the thieves’ guild.');
    await user.click(first.getByRole('button', { name: 'Save' }));
    expect(latest.sessionLog[0]!.text).toBe('Met the thieves’ guild.');

    const newest = within(entries.getAllByRole('listitem')[0]!);
    await user.click(newest.getByRole('button', { name: 'Delete' }));
    await user.click(newest.getByRole('button', { name: 'Delete this entry' }));
    expect(latest.sessionLog.map((n) => n.date)).toEqual(['2026-10-01']);
  });
});
