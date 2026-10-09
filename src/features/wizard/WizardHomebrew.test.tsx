// Homebrew through the creation wizard (plan step 7.4): a homebrew class, background, origin
// feat, species, spells and item, on top of the official fixture.

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../db/db.ts';
import { repos } from '../../db/repos.ts';
import type { Character } from '../../schema/index.ts';
import { seedHomebrew } from '../../test/homebrewFixture.ts';
import { renderApp } from '../../test/renderApp.tsx';
import { seedFixtureContent } from '../../test/seedContent.ts';

beforeEach(async () => {
  await resetDb('test-wizard-homebrew');
  await seedFixtureContent(['TST']);
  await seedHomebrew(['TST', 'HearthGuide', 'BrutePaths']);
});

type User = ReturnType<typeof userEvent.setup>;

const next = (name: RegExp) => screen.getByRole('button', { name });
const equipmentA = (where: ReturnType<typeof within>) =>
  within(where.getByRole('region', { name: 'Starting equipment' })).getByRole('radio', {
    name: /Option A/,
  });

/**
 * Pick a card and return it, opened. The list can render once more while the content settles
 * (a larger import takes longer), so the pick is retried on the list as it is now.
 */
async function pick(user: User, name: string) {
  await waitFor(async () => {
    const item = screen.queryByRole('listitem', { name });
    if (!item) await user.click(screen.getByRole('radio', { name }));
    expect(screen.getByRole('listitem', { name })).toBeInTheDocument();
  });
  return within(screen.getByRole('listitem', { name }));
}

async function stored(check: (c: Character) => boolean): Promise<Character> {
  let found: Character | undefined;
  await waitFor(async () => {
    found = (await repos().characters.list()).find(check);
    expect(found).toBeDefined();
  });
  return found!;
}

describe('creation wizard with homebrew', () => {
  it('creates a homebrew Hearthwarden: class, background, feat, species, spells, item', async () => {
    const user = userEvent.setup();
    renderApp('/new/draft/class');

    await screen.findByRole('radio', { name: 'Hearthwarden' });
    const cls = await pick(user, 'Hearthwarden');
    await user.click(cls.getByRole('checkbox', { name: 'Medicine' }));
    await user.click(cls.getByRole('checkbox', { name: 'Insight' }));
    await user.click(equipmentA(cls));
    await user.click(next(/Background ›/));

    await screen.findByRole('radio', { name: 'Lamplighter' });
    const bg = await pick(user, 'Lamplighter');
    await user.click(bg.getByRole('radio', { name: '+2 Wisdom, +1 Constitution' }));
    expect(bg.getByText('Origin feat: Kettle Sage')).toBeInTheDocument();
    const [languages] = bg.getAllByRole('region', { name: 'Languages' });
    await user.click(within(languages!).getByRole('checkbox', { name: 'Arenic' }));
    await user.click(equipmentA(bg));
    await user.click(next(/Species ›/));

    await user.selectOptions(await screen.findByRole('combobox', { name: 'Species' }), 'Fernling');
    await user.click(next(/Ability scores ›/));
    await screen.findByRole('table', { name: 'Ability scores' });
    await user.click(next(/Spells ›/));

    // The class's cantrips: its own and the ones it borrows (the Lorekeeper's list, Spark Bolt).
    const cantrips = within(await screen.findByRole('region', { name: 'Cantrips' }));
    expect(cantrips.queryByRole('checkbox', { name: /Glitter Burst/ })).not.toBeInTheDocument();
    await user.click(cantrips.getByRole('checkbox', { name: /Cinder Flick/ }));
    await user.click(cantrips.getByRole('checkbox', { name: /Spark Bolt/ }));
    // Prepared spells (3, from its "Spells Known" column), from its own list and the borrowed one.
    const prepared = within(screen.getByRole('region', { name: 'Hearthwarden prepared spells' }));
    expect(prepared.getByText(/Prepare up to 3 spells/)).toBeInTheDocument();
    for (const spell of [/Warm Hearth/, /Ink Cloud/, /Dim Lantern/])
      await user.click(prepared.getByRole('checkbox', { name: spell }));
    await user.click(next(/Details ›/));

    const name = await screen.findByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Wren');
    await user.click(next(/Review ›/));
    const items = within(await screen.findByRole('list', { name: 'Starting items' }));
    expect(items.getByText(/Ember Lantern/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create character' }));

    expect(await screen.findByRole('tab', { name: 'Main' })).toBeInTheDocument();
    const c = await stored((x) => x.name === 'Wren' && !x.draft);
    expect(c.log[0]).toMatchObject({
      classRef: { id: 'hearthwarden|hearthguide' },
      origin: {
        speciesRef: { id: 'fernling|hearthguide' },
        backgroundRef: { id: 'lamplighter|hearthguide' },
      },
    });
    expect(c.log[0]?.choices.find((r) => r.key.slot === 'cantrips.1')?.values.sort()).toEqual([
      'cinder flick|hearthguide',
      'spark bolt|tst',
    ]);
    expect(c.state.prepared['hearthwarden|hearthguide']?.sort()).toEqual([
      'dim lantern|tst',
      'ink cloud|tst',
      'warm hearth|hearthguide',
    ]);
    expect(c.inventory.map((r) => r.name)).toContain('Ember Lantern');
    expect(c.snapshots['feat:kettle sage|hearthguide']).toBeDefined();
  });
});
