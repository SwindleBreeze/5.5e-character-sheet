import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../db/db.ts';
import { repos } from '../../db/repos.ts';
import type { Character } from '../../schema/index.ts';
import { renderApp } from '../../test/renderApp.tsx';
import { seedFixtureContent } from '../../test/seedContent.ts';

beforeEach(async () => {
  await resetDb('test-wizard');
  await seedFixtureContent(['TST']);
});

const next = (name: RegExp) => screen.getByRole('button', { name });
const region = (name: string | RegExp) => within(screen.getByRole('region', { name }));

/** The draft as saved (saves are coalesced: wait for the one expected). */
async function stored(check: (c: Character) => boolean): Promise<Character> {
  let found: Character | undefined;
  await waitFor(async () => {
    found = (await repos().characters.list()).find(check);
    expect(found).toBeDefined();
  });
  return found!;
}

describe('creation wizard', () => {
  it('creates a level 1 character: class → background → species → … → review → sheet', async () => {
    const user = userEvent.setup();
    renderApp('/new/draft/class');

    await user.click(await screen.findByRole('radio', { name: 'Brute' }));
    expect(await screen.findByRole('region', { name: 'About the Brute' })).toBeInTheDocument();
    expect(region('About the Brute').getByText(/d12/)).toBeInTheDocument();
    await user.click(next(/Background ›/));

    await user.click(await screen.findByRole('radio', { name: 'Arena Hand' }));
    const arena = within(await screen.findByRole('region', { name: 'Arena Hand choices' }));
    await user.click(arena.getByRole('radio', { name: '+2 Strength, +1 Constitution' }));
    // The Origin feat, with its own picks, under the background.
    expect(arena.getByRole('region', { name: 'Spark Initiate; Gladiator' })).toBeInTheDocument();
    await user.click(next(/Species ›/));

    await user.click(await screen.findByRole('radio', { name: 'Mossling' }));
    const moss = within(await screen.findByRole('region', { name: 'Mossling choices' }));
    await user.click(moss.getByRole('radio', { name: 'Small' }));
    await user.click(next(/Ability scores ›/));

    // The standard array, Strength first for a Brute; the background's +2 shown applied.
    const scores = within(await screen.findByRole('table', { name: 'Ability scores' }));
    const strength = within(scores.getByRole('row', { name: /Strength/ }));
    expect(strength.getByRole('combobox', { name: 'Strength score' })).toHaveValue('15');
    expect(strength.getByText('17')).toBeInTheDocument();
    await user.click(next(/Equipment ›/));

    await user.click(region('Brute equipment').getByRole('radio', { name: /Option A/ }));
    await user.click(region('Arena Hand equipment').getByRole('radio', { name: /Option A/ }));
    const items = within(await screen.findByRole('list', { name: 'Starting items' }));
    expect(items.getByText('Net Blade (in hand)')).toBeInTheDocument();
    // Spark Initiate gives spells, so the spells step shows.
    await user.click(next(/Spells ›/));
    expect(
      await screen.findByRole('region', { name: /Spark Initiate; Gladiator spells/ }),
    ).toBeInTheDocument();
    await user.click(next(/Other choices ›/));

    const brute = within(await screen.findByRole('region', { name: 'Brute' }));
    await user.click(brute.getByRole('checkbox', { name: 'Intimidation' }));
    await user.click(brute.getByRole('checkbox', { name: 'Survival' }));
    await user.click(next(/Details ›/));

    const name = await screen.findByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Tess');
    await user.click(next(/Review ›/));

    expect(await screen.findByRole('heading', { name: 'Tess' })).toBeInTheDocument();
    const todo = within(screen.getByRole('region', { name: 'Still to choose' }));
    // The fixture has no artisan's tools, and too few Gladiator cantrips.
    expect(todo.getByText(/Arena Hand: Tools/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create character' }));

    // The sheet opens.
    expect(await screen.findByRole('tab', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Tess' })).toBeInTheDocument();
    const c = await stored((x) => x.name === 'Tess' && !x.draft);
    expect(c.log).toHaveLength(1);
    expect(c.log[0]).toMatchObject({
      classRef: { id: 'brute|tst' },
      hp: { mode: 'max' },
      origin: { speciesRef: { id: 'mossling|tst' }, backgroundRef: { id: 'arena hand|tst' } },
    });
    expect(c.log[0]?.choices.every((r) => r.via === 'creation')).toBe(true);
    expect(
      c.log[0]?.choices.find((r) => r.key.slot === 'skills' && r.key.owner.id === 'brute|tst')
        ?.values,
    ).toEqual(['intimidation', 'survival']);
    expect(c.baseScores.str).toBe(15);
    expect(c.inventory.map((r) => r.name)).toEqual(['Net Blade', 'Shiv', 'Torch']);
    expect(c.snapshots['class:brute|tst']).toBeDefined();
  });

  it('a draft is saved as it goes and continued from the characters list', async () => {
    const user = userEvent.setup();
    renderApp('/new/draft/class');
    await user.click(await screen.findByRole('radio', { name: 'Lorekeeper' }));
    await user.click(next(/Background ›/));
    await screen.findByRole('radio', { name: 'Arena Hand' });
    await stored((c) => c.draft?.step === 'background' && c.log.length === 1);
    cleanup();

    // Later: the list offers to continue, on the step it was left at.
    renderApp('/');
    await user.click(await screen.findByRole('link', { name: 'Continue creating New character' }));
    expect(await screen.findByRole('radio', { name: 'Arena Hand' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '2. Background' })).toHaveAttribute(
      'aria-current',
      'step',
    );
    await user.click(screen.getByRole('link', { name: '1. Class' }));
    expect(await screen.findByRole('radio', { name: 'Lorekeeper' })).toBeChecked();
  });

  it('changing the class removes only the picks the old class offered, after confirming', async () => {
    const user = userEvent.setup();
    renderApp('/new/draft/class');
    await user.click(await screen.findByRole('radio', { name: 'Brute' }));
    await user.click(next(/Background ›/));
    await user.click(await screen.findByRole('radio', { name: 'Arena Hand' }));
    await user.click(await screen.findByRole('radio', { name: '+2 Strength, +1 Constitution' }));
    await user.click(screen.getByRole('link', { name: /Other choices/ }));
    const brute = within(await screen.findByRole('region', { name: 'Brute' }));
    // Athletics comes from Arena Hand already.
    await user.click(brute.getByRole('checkbox', { name: 'Intimidation' }));
    await user.click(screen.getByRole('link', { name: '1. Class' }));

    await user.click(await screen.findByRole('radio', { name: 'Lorekeeper' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Remove picks?' }));
    expect(dialog.getByRole('list', { name: 'Picks to remove' })).toHaveTextContent(
      'Brute: Intimidation',
    );
    // Cancel keeps everything.
    await user.click(dialog.getByRole('button', { name: 'Keep things as they are' }));
    expect(screen.getByRole('radio', { name: 'Brute' })).toBeChecked();

    await user.click(screen.getByRole('radio', { name: 'Lorekeeper' }));
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Change and remove them',
      }),
    );
    expect(await screen.findByRole('region', { name: 'About the Lorekeeper' })).toBeInTheDocument();
    const c = await stored((x) => x.log[0]?.classRef.id === 'lorekeeper|tst');
    expect(c.log[0]?.choices.map((r) => `${r.key.owner.id}#${r.key.slot}`)).toEqual([
      'arena hand|tst#ability',
    ]);
  });

  it('ability scores: point buy keeps to 27 points; rolled scores show their dice', async () => {
    const user = userEvent.setup();
    renderApp('/new/draft/class');
    await user.click(await screen.findByRole('radio', { name: 'Brute' }));
    await user.click(screen.getByRole('link', { name: /Ability scores/ }));
    await user.click(await screen.findByRole('button', { name: 'Point buy' }));
    expect(await screen.findByText(/points left/)).toHaveTextContent('27 of 27 points left');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Strength score' }), '15');
    expect(screen.getByText(/points left/)).toHaveTextContent('18 of 27 points left');
    await user.click(screen.getByRole('button', { name: 'Roll' }));
    expect(await screen.findByRole('list', { name: 'Rolled scores' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Rolled scores' })).getAllByRole('listitem'),
    ).toHaveLength(6);
  });
});
