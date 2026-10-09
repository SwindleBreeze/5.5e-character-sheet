// The automated accessibility check on each screen (plan §10.3, step 7.8): every control has a
// name, ids are unique, headings don't skip levels, and the rest of src/test/a11y.ts. The
// screens are rendered as the app shows them, with fixture content and a quick-built character.

import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState, type ComponentType } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildBackup } from '../db/backup.ts';
import { createCharacterRepo, newCharacter } from '../db/characterRepo.ts';
import { resetDb } from '../db/db.ts';
import { repos } from '../db/repos.ts';
import { writeCharacterMarker } from '../db/storage.ts';
import { createCatalog } from '../engine/build/catalog.ts';
import { WIZARD_STEPS } from '../engine/build/wizard.ts';
import { quickBuild } from '../engine/build/quickBuild.ts';
import type { ContentIndex } from '../engine/content/contentIndex.ts';
import { derive } from '../engine/derive/derive.ts';
import { DescriptionTab } from '../features/sheet/DescriptionTab.tsx';
import { ExtrasTab } from '../features/sheet/ExtrasTab.tsx';
import { FeaturesTab } from '../features/sheet/FeaturesTab.tsx';
import { SHEET_TABS } from '../features/sheet/sheetTabs.ts';
import type { CharacterUpdate } from '../features/sheet/useCharacterActions.ts';
import type { Character, ContentEntity } from '../schema/index.ts';
import { a11yIssues, expectAccessible } from '../test/a11y.ts';
import { testCharacter } from '../test/characters.ts';
import { FIXTURE_FEATURE_EFFECTS } from '../test/fixtureFeatureEffects.ts';
import { fixtureContent, fixtureIndex } from '../test/fixtureIndex.ts';
import { seedHomebrew } from '../test/homebrewFixture.ts';
import { renderApp } from '../test/renderApp.tsx';
import { face, fixedRng } from '../test/rng.ts';
import { seedFixtureContent } from '../test/seedContent.ts';
import { SheetProvider } from '../ui/BottomSheet.tsx';
import { RollerProvider } from '../ui/Roller.tsx';
import { Durability } from './Durability.tsx';
import { listenForInstall, resetInstallState } from './install.ts';

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
    // Every step by its address: a step not reached yet is shown all the same.
    const steps = WIZARD_STEPS.map((step) => `/new/${c.id}/${step}`);
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

type TabProps = {
  character: Character;
  sheet: ReturnType<typeof derive>;
  index: ContentIndex;
  apply: (update: CharacterUpdate) => void;
};

/** One sheet tab on its own, with the fixture's feature mappings (as the tab tests do). */
async function renderTab(Tab: ComponentType<TabProps>, initial: Character) {
  const index = await fixtureIndex();
  function Harness() {
    const ref = useRef(initial);
    const [character, setCharacter] = useState(initial);
    const sheet = derive(character, index, { registry: FIXTURE_FEATURE_EFFECTS });
    const apply = (update: CharacterUpdate) => {
      ref.current = update(ref.current);
      setCharacter(ref.current);
    };
    return <Tab character={character} sheet={sheet} index={index} apply={apply} />;
  }
  return render(
    <MemoryRouter>
      <RollerProvider>
        <SheetProvider>
          <Harness />
        </SheetProvider>
      </RollerProvider>
    </MemoryRouter>,
  );
}

const dialog = () => within(screen.getByRole('dialog'));

describe('phase 7 screens pass the accessibility check', () => {
  beforeAll(() => listenForInstall(window));

  it('Extras: adding a summon, its card, and Wild Shape forms', async () => {
    const user = userEvent.setup();
    const ada = testCharacter({
      name: 'Ada',
      classes: [{ classId: 'lorekeeper|tst', levels: 5 }],
      scores: { int: 16 },
    });
    ada.state.prepared['lorekeeper|tst'] = ['rolling boom|tst'];
    await renderTab(ExtrasTab, ada);
    expectAccessible();
    await user.click(screen.getByRole('button', { name: 'Add' }));
    const suggested = await dialog().findByRole('list', { name: 'Suggested creatures' });
    expectAccessible();
    await user.click(within(suggested).getByRole('button', { name: /Boom Spirit \(Air\)/ }));
    expectAccessible();
    await user.click(dialog().getByRole('button', { name: 'Add' }));
    await screen.findByRole('listitem', { name: 'Boom Spirit (Air)' });
    expectAccessible();
    cleanup();

    const bree = testCharacter({
      name: 'Bree',
      classes: [{ classId: 'wanderer|tst', levels: 4 }],
      scores: { wis: 14 },
    });
    await renderTab(ExtrasTab, bree);
    const forms = within(screen.getByRole('region', { name: 'Beast Form' }));
    await user.click(forms.getByRole('button', { name: 'Choose forms' }));
    const beasts = await dialog().findByRole('list', { name: 'Beasts' });
    expectAccessible();
    await user.click(within(beasts).getByRole('button', { name: /Moss Boar CR 1\/4/ }));
    await user.keyboard('{Escape}');
    await user.click(forms.getByRole('button', { name: 'Take the form of Moss Boar' }));
    await screen.findByRole('region', { name: 'In Wild Shape' });
    expectAccessible();
  });

  it('Features: adding an effect of your own', async () => {
    const user = userEvent.setup();
    const c = testCharacter({
      name: 'Ada',
      classes: [{ classId: 'gladiator|tst', levels: 4 }],
      speciesId: 'mossling|tst',
      backgroundId: 'arena hand|tst',
    });
    await renderTab(FeaturesTab, c);
    // A feature's row opens to show it, with the button to add an effect.
    const row = within(screen.getByRole('listitem', { name: 'Showmanship' }));
    await user.click(row.getByRole('button', { name: 'Showmanship' }));
    expectAccessible();
    await user.click(row.getByRole('button', { name: 'Add your own effect…' }));
    await screen.findByRole('dialog');
    expectAccessible();
    await user.click(dialog().getByRole('radio', { name: 'Bonus' }));
    expectAccessible();
  });

  it('Description: the Bastion card and its facility picker', async () => {
    const user = userEvent.setup();
    const c = testCharacter({
      name: 'Ada',
      classes: [{ classId: 'brute|tst', levels: 5 }],
      speciesId: 'mossling|tst',
      backgroundId: 'arena hand|tst',
    });
    await renderTab(DescriptionTab, c);
    const card = within(screen.getByRole('region', { name: 'Bastion' }));
    expectAccessible();
    await user.click(card.getByRole('button', { name: 'Add a facility' }));
    await screen.findByRole('dialog', { name: 'Add a facility' });
    expectAccessible();
    await user.click(await dialog().findByRole('button', { name: /^Spark Forge/ }));
    await user.click(dialog().getByRole('button', { name: 'Add Spark Forge' }));
    await card.findByRole('list', { name: 'Facilities' });
    expectAccessible();
  });

  it('Import and Settings with homebrew, and the install card', async () => {
    await seedHomebrew(['TST', 'HearthGuide', 'BrutePaths']);
    renderApp('/settings');
    await screen.findByRole('group', { name: 'Homebrew' });
    await settled();
    expectAccessible();
    cleanup();

    renderApp('/library/import');
    await screen.findByLabelText('Open pack file');
    expectAccessible();
    cleanup();

    resetInstallState();
    renderApp('/');
    await screen.findByRole('heading', { name: 'Characters' });
    const offer = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: vi.fn(async () => {}),
      userChoice: Promise.resolve({ outcome: 'dismissed' }),
    });
    act(() => {
      window.dispatchEvent(offer);
    });
    await screen.findByRole('heading', { name: 'Install the app' });
    expectAccessible();
  });

  it('the screen shown when the browser cleared the app’s data', async () => {
    await createCharacterRepo().save(newCharacter('Brin'));
    await buildBackup();
    await resetDb('test-a11y-cleared');
    writeCharacterMarker(1);
    render(
      <MemoryRouter>
        <SheetProvider>
          <Durability />
        </SheetProvider>
      </MemoryRouter>,
    );
    await screen.findByRole('dialog', { name: 'Your browser cleared this app’s data' });
    expectAccessible();
    writeCharacterMarker(0);
  });
});
