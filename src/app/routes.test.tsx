import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createCharacterRepo, newCharacter } from '../db/characterRepo.ts';
import { resetDb } from '../db/db.ts';
import { renderApp } from '../test/renderApp.tsx';

beforeEach(async () => {
  await resetDb('test-routes');
});

describe('routes', () => {
  it.each([
    ['/', 'Characters'],
    ['/library', 'Library'],
    ['/library/import', 'Import'],
    ['/settings', 'Settings'],
    ['/new/draft/class', 'New character'],
    ['/dev/design', 'Design gallery'],
    ['/nowhere', 'Not found'],
  ])('renders %s', async (path, heading) => {
    renderApp(path);
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
  });

  it('shows the bottom navigation on top-level screens and links between them', async () => {
    const user = userEvent.setup();
    renderApp('/');
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    await user.click(within(nav).getByRole('link', { name: /Settings/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
  });

  it('renders a character sheet with tabs and hides the bottom navigation', async () => {
    const character = await createCharacterRepo().save(newCharacter('Ada'));
    renderApp(`/c/${character.id}/spells`);

    expect(await screen.findByRole('heading', { level: 1, name: 'Ada' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Spells' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });

  it('switches sheet tabs through the URL', async () => {
    const user = userEvent.setup();
    const character = await createCharacterRepo().save(newCharacter('Ada'));
    renderApp(`/c/${character.id}/main`);

    await user.click(await screen.findByRole('tab', { name: 'Inventory' }));
    expect(screen.getByRole('tab', { name: 'Inventory' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Main' })).toHaveAttribute('aria-selected', 'false');
  });

  it('redirects an unknown tab to main', async () => {
    const character = await createCharacterRepo().save(newCharacter('Ada'));
    renderApp(`/c/${character.id}/bogus`);
    expect(await screen.findByRole('tab', { name: 'Main' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('reports a missing character', async () => {
    renderApp('/c/does-not-exist/main');
    expect(await screen.findByRole('heading', { level: 1, name: 'Not found' })).toBeInTheDocument();
  });
});
