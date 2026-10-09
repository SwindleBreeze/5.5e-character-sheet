// The automated accessibility check on each screen (plan §10.3, step 7.8): every control has a
// name, ids are unique, headings don't skip levels, and the rest of src/test/a11y.ts. The
// screens are rendered as the app shows them, with fixture content and a quick-built character.

import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { newCharacter } from '../db/characterRepo.ts';
import { resetDb } from '../db/db.ts';
import { repos } from '../db/repos.ts';
import { createCatalog } from '../engine/build/catalog.ts';
import { quickBuild } from '../engine/build/quickBuild.ts';
import type { Character, ContentEntity } from '../schema/index.ts';
import { a11yIssues, expectAccessible } from '../test/a11y.ts';
import { fixtureContent } from '../test/fixtureIndex.ts';
import { renderApp } from '../test/renderApp.tsx';
import { face, fixedRng } from '../test/rng.ts';
import { seedFixtureContent } from '../test/seedContent.ts';
import { SHEET_TABS } from '../features/sheet/sheetTabs.ts';

/** A level `levels` character, built the way the quick builder does. */
async function built(classId: string, levels: number, extra: Partial<Character> = {}) {
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
  return repos().characters.save({ ...c, ...extra }, 1);
}

/** Until nothing on the page is still loading. */
const settled = () =>
  waitFor(() => expect(screen.queryAllByText(/^(Loading|Starting)…$/)).toEqual([]));

beforeEach(async () => {
  await resetDb('test-a11y');
  await seedFixtureContent(['TST']);
});

describe('the checker', () => {
  it('finds unnamed controls, missing alt, duplicate ids, skipped headings and broken refs', () => {
    document.body.innerHTML = `
      <h1>Title</h1><h3>Skipped</h3>
      <button></button><button aria-label="Named"></button>
      <img src="x.png"><img src="y.png" alt="">
      <input type="text"><label>Name <input type="text"></label>
      <div id="twice"></div><div id="twice"></div>
      <div aria-labelledby="nowhere"></div>
      <a href="#"><button>Inner</button></a>
      <div aria-hidden="true"><button>Hidden</button></div>
      <div hidden><button></button></div>`;
    expect(a11yIssues().map((i) => i.rule)).toEqual([
      'duplicate-id',
      'heading-order',
      'control-name',
      'image-alt',
      'control-name',
      'aria-ref',
      'nested-interactive',
      'aria-hidden-focus',
    ]);
    document.body.innerHTML = '';
  });
});

describe('every screen passes the accessibility check', () => {
  it('Characters: empty, listed, and a character’s menu', async () => {
    renderApp('/');
    await screen.findByText('No characters yet.');
    expectAccessible();
    cleanup();

    await repos().characters.save(newCharacter('Ada'), 1);
    await built('brute|tst', 3);
    const user = userEvent.setup();
    renderApp('/');
    await screen.findByText('Ada');
    expectAccessible();
    await user.click(screen.getByRole('button', { name: 'More actions for Ada' }));
    expectAccessible();
    await user.click(await screen.findByRole('button', { name: 'Delete…' }));
    await screen.findByRole('heading', { name: 'Delete Ada?' });
    expectAccessible();
  });

  it('every sheet tab', async () => {
    const c = await built('brute|tst', 5);
    for (const tab of SHEET_TABS) {
      renderApp(`/c/${c.id}/${tab.id}`);
      await screen.findByRole('heading', { level: 1, name: 'Grosh' });
      await screen.findByRole('tab', { name: tab.label, selected: true });
      await settled();
      expectAccessible();
      cleanup();
    }
  });

  it('a spellcaster’s Spells tab', async () => {
    const c = await built('lorekeeper|tst', 3);
    renderApp(`/c/${c.id}/spells`);
    await screen.findByRole('tab', { name: 'Spells', selected: true });
    await settled();
    expectAccessible();
  });

  it('the bottom sheet and a roll’s toast', async () => {
    const user = userEvent.setup();
    const c = await built('brute|tst', 5);
    renderApp(`/c/${c.id}/main`, fixedRng([face(15, 20)]));
    await user.click(await screen.findByRole('button', { name: /^Strength score 18/ }));
    await screen.findByRole('dialog');
    expectAccessible();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Roll Athletics, +7' }));
    within(screen.getByRole('status', { name: 'Rolls' })).getByRole('button', {
      name: 'Athletics: 22. Dismiss',
    });
    expectAccessible();
  });

  it('every wizard step', async () => {
    const c = await built('lorekeeper|tst', 1, { draft: { step: 'class' } });
    renderApp(`/new/${c.id}/class`);
    const steps = within(await screen.findByRole('list', { name: 'Steps' }))
      .getAllByRole('link')
      .map((a) => a.getAttribute('href')!.replace(/^#/, ''));
    expect(steps.length).toBeGreaterThan(6);
    cleanup();
    for (const path of steps) {
      renderApp(path);
      await screen.findByRole('list', { name: 'Steps' });
      await settled();
      expectAccessible();
      cleanup();
    }
  });

  it('level-up steps', async () => {
    const user = userEvent.setup();
    const c = await built('brute|tst', 2);
    renderApp(`/c/${c.id}/level-up`);
    await user.click(await screen.findByRole('radio', { name: 'Brute 3' }));
    expectAccessible();
    const footer = () => within(screen.getByRole('navigation', { name: 'Level up' }));
    // Through every step, taking the first option where a pick is due.
    for (let i = 0; i < 8 && !screen.queryByRole('heading', { name: 'Review', level: 2 }); i++) {
      const forward = footer().getAllByRole('button').at(-1)!;
      if (forward.getAttribute('aria-disabled') === 'true') {
        const unpicked = [...screen.queryAllByRole('radio'), ...screen.queryAllByRole('checkbox')]
          .filter((x) => !(x as HTMLInputElement).checked)
          .filter((x) => !x.closest('label')?.textContent?.includes('Ignore rules'));
        for (const x of unpicked.slice(0, 3)) await user.click(x);
      }
      await user.click(forward);
      expectAccessible();
    }
    expect(screen.getByRole('heading', { name: 'Review', level: 2 })).toBeInTheDocument();
  });

  it('Library, Import and Settings', async () => {
    renderApp('/library');
    await screen.findByRole('list', { name: 'Results' });
    await settled();
    expectAccessible();
    cleanup();

    renderApp('/library/import');
    await screen.findByLabelText('Open pack file');
    expectAccessible();
    cleanup();

    renderApp('/settings');
    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    await settled();
    expectAccessible();
  });
});

describe('focus order', () => {
  it('a sheet takes focus when it opens, keeps Tab inside, and gives focus back on close', async () => {
    const user = userEvent.setup();
    const c = await built('brute|tst', 5);
    renderApp(`/c/${c.id}/main`);
    const score = await screen.findByRole('button', { name: /^Strength score 18/ });
    await user.click(score);
    const dialog = await screen.findByRole('dialog', { name: 'Strength' });
    await waitFor(() => expect(dialog).toHaveFocus());
    for (let i = 0; i < 6; i++) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(score).toHaveFocus());
  });

  it('the wizard and level-up move focus to the new step’s heading', async () => {
    const user = userEvent.setup();
    const c = await built('brute|tst', 2, { draft: { step: 'class' } });
    renderApp(`/new/${c.id}/class`);
    await user.click(await screen.findByRole('button', { name: /Background ›/ }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 2, name: 'Background' })).toHaveFocus(),
    );
    cleanup();

    const d = await built('brute|tst', 2);
    renderApp(`/c/${d.id}/level-up`);
    await user.click(await screen.findByRole('radio', { name: 'Brute 3' }));
    await user.click(screen.getByRole('button', { name: /Hit points ›/ }));
    expect(screen.getByRole('heading', { level: 2, name: 'Hit points' })).toHaveFocus();
  });
});
