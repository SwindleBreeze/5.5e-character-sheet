import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { newCharacter } from '../../db/characterRepo.ts';
import { resetDb } from '../../db/db.ts';
import { repos } from '../../db/repos.ts';
import { renderApp } from '../../test/renderApp.tsx';
import { seedFixtureContent } from '../../test/seedContent.ts';

beforeEach(async () => {
  await resetDb('test-shop');
});

const shelf = (name: string) => screen.getByRole('region', { name });
const itemsOn = (name: string) =>
  within(shelf(name))
    .getAllByRole('button')
    .map((b) => b.querySelector('span span')?.textContent);

describe('Shop', () => {
  it('points to the importer when there are no items', async () => {
    renderApp('/shop');
    expect(
      await screen.findByRole('link', { name: 'Import your group’s pack' }),
    ).toBeInTheDocument();
  });

  it('sorts the items of the enabled books by use, with their numbers; search opens them', async () => {
    const user = userEvent.setup();
    await seedFixtureContent();
    renderApp('/shop');
    const gear = await screen.findByText('Adventuring gear');
    await user.click(gear);
    // A torch is a light; a quiver holds things.
    expect(itemsOn('Light')).toEqual(['Torch']);
    expect(itemsOn('Containers')).toContain('Quiver');
    await user.click(screen.getByText('Weapons and ammunition'));
    expect(itemsOn('Martial ranged weapons')).toEqual(['Arc Bow', 'Wrist Bow']);
    expect(
      within(shelf('Martial ranged weapons')).getByRole('button', { name: /^Arc Bow/ }),
    ).toHaveTextContent(/25 GP/);
    await user.click(screen.getByText('Magic items'));
    expect(itemsOn('Rings')).toEqual(['Ring of Loud Shouting']);

    await user.type(screen.getByRole('searchbox', { name: 'Find an item' }), 'torch');
    // Every group with a match opens; the magic torch is with the magic items.
    await waitFor(() => expect(itemsOn('Light')).toEqual(['Torch']));
    expect(itemsOn('Wondrous items and others')).toEqual(['Everburning Torch']);
  });

  it('buys an item for a character, paying from their coins, or says they are short', async () => {
    const user = userEvent.setup();
    await seedFixtureContent();
    const ada = newCharacter('Ada', 0);
    ada.currency.gp = 30;
    await repos().characters.save(ada, 1);
    renderApp('/shop');
    await user.type(await screen.findByRole('searchbox', { name: 'Find an item' }), 'arc bow');
    await user.click(await screen.findByRole('button', { name: /^Arc Bow/ }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Arc Bow' }));
    expect(await dialog.findByRole('combobox', { name: 'For' })).toHaveDisplayValue('Ada (30 GP)');
    expect(dialog.getByRole('textbox', { name: 'Price each (GP)' })).toHaveValue('25');
    expect(dialog.getByRole('checkbox', { name: 'Pay from Ada’s coins' })).toBeChecked();

    await user.click(dialog.getByRole('button', { name: 'Buy' }));
    expect(await dialog.findByRole('status')).toHaveTextContent(
      'Arc Bow added to Ada’s items, 25 GP paid.',
    );
    let saved = (await repos().characters.get(ada.id))!;
    expect(saved.inventory.map((r) => r.name)).toEqual(['Arc Bow']);
    expect(saved.currency.gp).toBe(5);

    // A second is more than Ada has left: nothing changes.
    await user.click(dialog.getByRole('button', { name: 'Buy' }));
    expect(await dialog.findByText('Ada has 5 GP: not enough for 25 GP.')).toBeInTheDocument();
    // Free (a gift, or the DM's price): no coins paid.
    await user.click(dialog.getByRole('checkbox', { name: 'Pay from Ada’s coins' }));
    await user.click(dialog.getByRole('button', { name: 'Buy' }));
    await waitFor(async () =>
      expect((await repos().characters.get(ada.id))!.inventory).toHaveLength(2),
    );
    saved = (await repos().characters.get(ada.id))!;
    expect(saved.currency.gp).toBe(5);
  });
});
