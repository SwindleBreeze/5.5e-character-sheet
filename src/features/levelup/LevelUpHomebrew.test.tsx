// Homebrew through level-up (plan step 7.4): a homebrew class takes its homebrew subclass, and
// an official class takes a homebrew one.

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../db/db.ts';
import { repos } from '../../db/repos.ts';
import { createCatalog } from '../../engine/build/catalog.ts';
import { quickBuild } from '../../engine/build/quickBuild.ts';
import type { Character } from '../../schema/index.ts';
import { homebrewContent, seedHomebrew } from '../../test/homebrewFixture.ts';
import { renderApp } from '../../test/renderApp.tsx';
import { seedFixtureContent } from '../../test/seedContent.ts';

const ENABLED = ['TST', 'HearthGuide', 'BrutePaths'];

beforeEach(async () => {
  await resetDb('test-levelup-homebrew');
  await seedFixtureContent(['TST']);
  await seedHomebrew(ENABLED);
});

async function saved(classId: string, levels: number): Promise<Character> {
  const { index, all } = await homebrewContent();
  const c = quickBuild(
    {
      name: 'Wren',
      classes: [{ classId, levels }],
      speciesId: 'fernling|hearthguide',
      backgroundId: 'lamplighter|hearthguide',
    },
    { index, catalog: createCatalog(all, new Set(ENABLED)), now: 1 },
  );
  return repos().characters.save(c, 1);
}

const next = (name: RegExp) => screen.getByRole('button', { name });

/** Through the steps after Hit points, taking the first option where a pick is due. */
async function toReview(user: ReturnType<typeof userEvent.setup>) {
  const footer = () => within(screen.getByRole('navigation', { name: 'Level up' }));
  for (let i = 0; i < 8 && !screen.queryByRole('button', { name: /^Apply level/ }); i++) {
    const forward = footer().getAllByRole('button').at(-1)!;
    if (forward.getAttribute('aria-disabled') === 'true') {
      const options = [...screen.queryAllByRole('radio'), ...screen.queryAllByRole('checkbox')]
        .filter((x) => !(x as HTMLInputElement).checked)
        .filter((x) => !x.closest('label')?.textContent?.includes('Ignore rules'));
      for (const o of options) {
        if (forward.getAttribute('aria-disabled') !== 'true') break;
        await user.click(o);
      }
    }
    await user.click(forward);
  }
}

describe('level-up with homebrew', () => {
  it('a homebrew class takes its homebrew subclass at level 3', async () => {
    const user = userEvent.setup();
    const c = await saved('hearthwarden|hearthguide', 2);
    renderApp(`/c/${c.id}/level-up`);
    await user.click(await screen.findByRole('radio', { name: 'Hearthwarden 3' }));
    await user.click(next(/Hit points ›/));
    await user.click(next(/Subclass ›/));
    await user.click(screen.getByRole('radio', { name: 'Oath of Embers' }));
    await user.click(next(/Features ›/));
    expect(screen.getByRole('article', { name: 'Hearth Oath' })).toBeInTheDocument();
    await toReview(user);
    await user.click(screen.getByRole('button', { name: 'Apply level 3' }));

    await waitFor(async () => expect((await repos().characters.get(c.id))!.log).toHaveLength(3));
    const after = (await repos().characters.get(c.id))!;
    expect(after.log[2]).toMatchObject({
      classRef: { id: 'hearthwarden|hearthguide' },
      subclassRef: { id: 'embers|hearthwarden|hearthguide|hearthguide' },
    });
  });

  it('an official class takes a homebrew subclass', async () => {
    const user = userEvent.setup();
    const c = await saved('brute|tst', 2);
    renderApp(`/c/${c.id}/level-up`);
    await user.click(await screen.findByRole('radio', { name: 'Brute 3' }));
    await user.click(next(/Hit points ›/));
    await user.click(next(/Subclass ›/));
    await user.click(screen.getByRole('radio', { name: 'Path of the Kettle' }));
    await user.click(next(/Features ›/));
    await toReview(user);
    await user.click(screen.getByRole('button', { name: 'Apply level 3' }));

    await waitFor(async () => expect((await repos().characters.get(c.id))!.log).toHaveLength(3));
    const after = (await repos().characters.get(c.id))!;
    expect(after.log[2]?.subclassRef?.id).toBe('kettle|brute|tst|brutepaths');
  });
});
