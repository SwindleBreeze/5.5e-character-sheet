import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../db/db.ts';
import { repos } from '../../db/repos.ts';
import { createCatalog } from '../../engine/build/catalog.ts';
import { quickBuild } from '../../engine/build/quickBuild.ts';
import type { Character, ContentEntity } from '../../schema/index.ts';
import { fixtureContent } from '../../test/fixtureIndex.ts';
import { renderApp } from '../../test/renderApp.tsx';
import { seedFixtureContent } from '../../test/seedContent.ts';

beforeEach(async () => {
  await resetDb('test-levelup');
  await seedFixtureContent(['TST']);
});

async function saved(classId: string, levels: number): Promise<Character> {
  const { index, entities } = await fixtureContent();
  const catalog = createCatalog(
    Object.values(entities).flat() as ContentEntity[],
    new Set(['TST']),
  );
  const c = quickBuild(
    {
      name: 'Grosh',
      classes: [{ classId, levels }],
      speciesId: 'mossling|tst',
      backgroundId: 'arena hand|tst',
    },
    { index, catalog, now: 1 },
  );
  return repos().characters.save(c, 1);
}

const next = (name: RegExp) => screen.getByRole('button', { name });
const footer = () => within(screen.getByRole('navigation', { name: 'Level up' }));

describe('level-up flow (plan §9.4, step 5.2)', () => {
  it('a level with a subclass, hit points and spells; applied to the character', async () => {
    const user = userEvent.setup();
    const c = await saved('brute|tst', 2);
    renderApp(`/c/${c.id}/level-up`);
    // Nothing goes on before a class is picked.
    await screen.findByRole('radio', { name: 'Brute 3' });
    expect(next(/Hit points ›/)).toHaveAttribute('aria-disabled', 'true');
    await user.click(screen.getByRole('radio', { name: 'Brute 3' }));
    // The level's features at a glance on its card.
    expect(screen.getByText(/At this level:/).closest('p')).toHaveTextContent('Brute Path');
    await user.click(next(/Hit points ›/));

    // Hit points: the fixed value, or a roll typed in.
    const hp = within(screen.getByRole('region', { name: 'Hit points' }));
    expect(hp.getByRole('radio', { name: 'Fixed: 7' })).toBeChecked();
    await user.click(hp.getByRole('radio', { name: 'Roll a d12' }));
    const rolled = hp.getByRole('spinbutton', { name: 'Rolled' });
    await user.clear(rolled);
    await user.type(rolled, '9');
    expect(screen.getByRole('region', { name: 'Hit points' })).toHaveTextContent(
      /\+\d+ hit points \(9 [+−-]\d+ Constitution\)/,
    );
    await user.click(next(/Subclass ›/));

    // The subclass is due: Next stays closed until it is picked.
    expect(next(/Features ›/)).toHaveAttribute('aria-disabled', 'true');
    expect(footer().getByText('Choose a Brute Path')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Path of the Spark' }));
    await user.click(next(/Features ›/));
    expect(screen.getByRole('article', { name: 'Brute Path' })).toBeInTheDocument();

    // The subclass casts: a Spells step, with a cantrip and two spells to pick.
    await user.click(next(/Spells ›/));
    for (const name of ['Path of the Spark: Cantrips', 'Path of the Spark: Spells']) {
      const region = within(screen.getByRole('region', { name }));
      const options = [
        ...region.queryAllByRole('radio'),
        ...region.queryAllByRole('checkbox'),
      ].filter((x) => !x.closest('label')?.textContent?.includes('Ignore rules'));
      // One cantrip; two level 1 spells (the fixture has just two).
      for (const option of options) await user.click(option);
    }
    expect(next(/Review ›/)).toHaveAttribute('aria-disabled', 'false');
    await user.click(next(/Review ›/));

    const summary = within(screen.getByRole('region', { name: 'Summary' }));
    expect(summary.getByText('3: Brute 3')).toBeInTheDocument();
    expect(summary.getByText('Path of the Spark', { selector: 'dd' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Apply level 3' }));

    expect(await screen.findByRole('tab', { name: 'Main' })).toBeInTheDocument();
    await waitFor(async () => expect((await repos().characters.get(c.id))!.log).toHaveLength(3));
    const after = (await repos().characters.get(c.id))!;
    expect(after.log[2]).toMatchObject({
      charLevel: 3,
      classLevel: 3,
      classRef: { id: 'brute|tst' },
      subclassRef: { id: expect.stringContaining('spark') },
      hp: { mode: 'roll', value: 9 },
    });
    expect(after.log[2]!.choices.every((r) => r.via === 'levelUp')).toBe(true);
    expect(after.log[2]!.choices.length).toBeGreaterThan(0);
  });

  it('multiclassing: the 2024 requirement is shown, and warned, not blocked', async () => {
    const user = userEvent.setup();
    const c = await saved('brute|tst', 1);
    renderApp(`/c/${c.id}/level-up`);
    const pact = await screen.findByRole('radio', { name: 'Pactbinder 1' });
    expect(pact).toHaveAccessibleDescription(/Needs Pactbinder: Charisma 13\+/);
    await user.click(pact);
    expect(screen.getByText(/Your DM may allow it anyway/)).toBeInTheDocument();
    expect(next(/Hit points ›/)).toHaveAttribute('aria-disabled', 'false');
  });

  it('undo the last level from the sheet, after confirming', async () => {
    const user = userEvent.setup();
    const c = await saved('brute|tst', 4);
    renderApp(`/c/${c.id}/main`);
    await user.click(await screen.findByRole('button', { name: /^More: rests/ }));
    const menu = within(await screen.findByRole('dialog', { name: 'More' }));
    await user.click(menu.getByRole('button', { name: /^Undo last level/ }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Undo level 4' }));
    expect(sheet.getByRole('list', { name: 'Choices to remove' })).toHaveTextContent(
      'Ability Score Improvement',
    );
    await user.click(sheet.getByRole('button', { name: 'Undo level 4' }));
    await waitFor(async () => expect((await repos().characters.get(c.id))!.log).toHaveLength(3));
  });

  it('earlier picks the rules let change on a level can be swapped, as a retrain (plan step 5.7)', async () => {
    const user = userEvent.setup();
    const c = await saved('pactbinder|tst', 3);
    renderApp(`/c/${c.id}/level-up`);
    await user.click(await screen.findByRole('radio', { name: 'Pactbinder 4' }));
    await user.click(next(/Hit points ›/));
    await user.click(next(/Features ›/));
    // The Ability Score Improvement's feat first; then the spells, where the swaps are.
    const feat = within(screen.getByRole('region', { name: /Ability Score Improvement/ }));
    await user.click(feat.getAllByRole('radio')[0]!);
    // Arena Veteran asks for an increase of its own, under it.
    await user.click(feat.getByRole('radio', { name: 'Charisma' }));
    await user.click(next(/Spells ›/));
    await user.click(screen.getByText(/Change an earlier choice/));
    const known = screen.getAllByRole('region', { name: /^Change / })[0]!;
    expect(
      within(known).getByText(/You can change this when you gain a level/),
    ).toBeInTheDocument();
  });
});
