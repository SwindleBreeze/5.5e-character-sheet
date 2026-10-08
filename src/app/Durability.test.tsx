import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildBackup } from '../db/backup.ts';
import { createCharacterRepo, newCharacter } from '../db/characterRepo.ts';
import { resetDb } from '../db/db.ts';
import { repos } from '../db/repos.ts';
import { readCharacterMarker, writeCharacterMarker } from '../db/storage.ts';
import { SheetProvider } from '../ui/BottomSheet.tsx';
import { Durability } from './Durability.tsx';

const renderDurability = () =>
  render(
    <MemoryRouter>
      <SheetProvider>
        <Durability />
      </SheetProvider>
    </MemoryRouter>,
  );

beforeEach(async () => {
  await resetDb('test-durability');
  writeCharacterMarker(0);
});

describe('durability (plan step 7.1)', () => {
  it('remembers that characters exist, in a second store', async () => {
    await createCharacterRepo().save(newCharacter('Ada'));
    renderDurability();
    await waitFor(() => expect(readCharacterMarker()).toBe(1));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('an empty database where characters were: says so, and restores from a backup', async () => {
    const user = userEvent.setup();
    await createCharacterRepo().save(newCharacter('Brin'));
    const text = JSON.stringify(await buildBackup());
    await resetDb('test-durability-2');
    writeCharacterMarker(1);
    renderDurability();

    const dialog = within(
      await screen.findByRole('dialog', { name: 'Your browser cleared this app’s data' }),
    );
    expect(dialog.getByText(/had a character/)).toBeInTheDocument();
    await user.upload(
      dialog.getByLabelText('Restore from a backup file…'),
      new File([text], 'b.backup.json'),
    );
    await user.click(await screen.findByRole('button', { name: 'Restore 1' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Your browser cleared this app’s data' }),
      ).toBeNull(),
    );
    expect((await repos().characters.list()).map((c) => c.name)).toEqual(['Brin']);
  });

  it('starting fresh forgets the characters that were', async () => {
    const user = userEvent.setup();
    writeCharacterMarker(2);
    renderDurability();
    await user.click(await screen.findByRole('button', { name: 'Start fresh' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(readCharacterMarker()).toBe(0);
  });
});
