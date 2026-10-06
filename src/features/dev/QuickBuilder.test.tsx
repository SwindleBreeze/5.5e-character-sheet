import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../db/db.ts';
import { repos } from '../../db/repos.ts';
import { renderApp } from '../../test/renderApp.tsx';
import { seedFixtureContent } from '../../test/seedContent.ts';

beforeEach(async () => {
  await resetDb('test-quick-builder');
});

describe('QuickBuilder', () => {
  it('is linked from Settings → Developer tools', async () => {
    const user = userEvent.setup();
    renderApp('/settings');
    await user.click(await screen.findByText('Developer tools'));
    await user.click(screen.getByRole('link', { name: 'Quick builder' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Quick builder' }),
    ).toBeInTheDocument();
  });

  it('says so when there is nothing to build from', async () => {
    renderApp('/dev/build');
    expect(await screen.findByText(/No classes are available/)).toBeInTheDocument();
  });

  it('builds a character, lists its derived values and saves it', async () => {
    const user = userEvent.setup();
    await seedFixtureContent();
    renderApp('/dev/build');

    await user.selectOptions(await screen.findByRole('combobox', { name: 'Class' }), 'brute|tst');
    const levels = screen.getByRole('spinbutton', { name: 'Levels' });
    await user.clear(levels);
    await user.type(levels, '5');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Species' }), 'mossling|tst');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Background' }),
      'arena hand|tst',
    );
    await user.click(screen.getByRole('button', { name: 'Build' }));

    expect(await screen.findByText(/Level 5: Brute 5 \(Path of the Spark\)/)).toBeInTheDocument();
    // Every number opens to its parts.
    const strength = screen.getByText('Strength').closest('details')!;
    expect(within(strength).getByText('18')).toBeInTheDocument();
    expect(within(strength).getByText(/Base score/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save to characters' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Quick build' }),
    ).toBeInTheDocument();
    // The sheet's Main tab shows the same values, from the character's own content.
    expect(await screen.findByText(/Level 5: Brute 5 \(Path of the Spark\)/)).toBeInTheDocument();
    const [saved] = await repos().characters.list();
    expect(saved?.log).toHaveLength(5);
  });

  it('adds and removes multiclass rows and caps the total level', async () => {
    const user = userEvent.setup();
    await seedFixtureContent();
    renderApp('/dev/build');

    const first = await screen.findByRole('spinbutton', { name: 'Levels' });
    await user.clear(first);
    await user.type(first, '15');
    await user.click(screen.getByRole('button', { name: 'Add a class' }));
    const second = screen.getAllByRole('spinbutton', { name: 'Levels' })[1]!;
    await user.clear(second);
    await user.type(second, '6');
    expect(screen.getByText('Total level 21')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Build' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Remove class 2' }));
    expect(screen.getByText('Total level 15')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Build' })).toBeEnabled();
  });
});
