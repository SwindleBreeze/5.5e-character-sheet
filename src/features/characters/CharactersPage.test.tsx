import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createCharacterRepo, newCharacter } from '../../db/characterRepo.ts';
import { resetDb } from '../../db/db.ts';
import { renderApp } from '../../test/renderApp.tsx';

beforeEach(async () => {
  await resetDb('test-characters');
});

describe('CharactersPage', () => {
  it('shows an empty state', async () => {
    renderApp('/');
    expect(await screen.findByText('No characters yet.')).toBeInTheDocument();
  });

  it('lists saved characters, newest first', async () => {
    const repo = createCharacterRepo();
    await repo.save(newCharacter('Ada'), 1);
    await repo.save(newCharacter('Bo'), 2);
    renderApp('/');

    const links = await screen.findAllByRole('link', { name: /Not built yet/ });
    expect(links.map((l) => l.textContent)).toEqual([
      expect.stringContaining('Bo'),
      expect.stringContaining('Ada'),
    ]);
  });

  it('duplicates a character from its menu', async () => {
    const user = userEvent.setup();
    await createCharacterRepo().save(newCharacter('Ada'));
    renderApp('/');

    await user.click(await screen.findByRole('button', { name: 'More actions for Ada' }));
    await user.click(await screen.findByRole('button', { name: 'Duplicate' }));

    expect(await screen.findByText('Ada (copy)')).toBeInTheDocument();
  });

  it('deletes a character after confirming', async () => {
    const user = userEvent.setup();
    await createCharacterRepo().save(newCharacter('Ada'));
    renderApp('/');

    await user.click(await screen.findByRole('button', { name: 'More actions for Ada' }));
    await user.click(await screen.findByRole('button', { name: 'Delete…' }));
    expect(await screen.findByRole('heading', { name: 'Delete Ada?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.getByText('No characters yet.')).toBeInTheDocument());
  });
});
