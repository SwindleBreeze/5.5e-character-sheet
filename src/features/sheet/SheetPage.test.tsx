import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../db/db.ts';
import { repos } from '../../db/repos.ts';
import { createCatalog } from '../../engine/build/catalog.ts';
import { quickBuild } from '../../engine/build/quickBuild.ts';
import type { Character, ContentEntity } from '../../schema/index.ts';
import { fixtureContent } from '../../test/fixtureIndex.ts';
import { renderApp } from '../../test/renderApp.tsx';
import { face, fixedRng } from '../../test/rng.ts';
import { seedFixtureContent } from '../../test/seedContent.ts';
import { SAVE_DELAY_MS } from './useCharacterActions.ts';

/** Brute 5, Mossling, Arena Hand, built the way the quick builder does. */
async function savedBrute(): Promise<Character> {
  const { index, entities } = await fixtureContent();
  const catalog = createCatalog(
    Object.values(entities).flat() as ContentEntity[],
    new Set(['TST']),
  );
  const c = quickBuild(
    {
      name: 'Grosh',
      classes: [{ classId: 'brute|tst', levels: 5 }],
      speciesId: 'mossling|tst',
      backgroundId: 'arena hand|tst',
    },
    { index, catalog, now: 1 },
  );
  return repos().characters.save(c, 1);
}

const stored = async (id: string) => (await repos().characters.get(id))!;
/** Wait for the coalesced save to land. */
const saved = () => act(() => new Promise((r) => setTimeout(r, SAVE_DELAY_MS + 50)));
const hp = (current: number) => new RegExp(`^Hit points ${current} of 50`);

let character: Character;

beforeEach(async () => {
  await resetDb('test-sheet');
  await seedFixtureContent(['TST']);
  character = await savedBrute();
});

describe('sheet header and Main tab', () => {
  it('shows the character: header, abilities, saves, skills and the rest', async () => {
    renderApp(`/c/${character.id}/main`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Grosh' })).toBeInTheDocument();
    expect(await screen.findByText('Brute 5 (Path of the Spark)')).toBeInTheDocument();
    const strength = screen.getByRole('group', { name: 'Strength' });
    expect(
      within(strength).getByRole('button', { name: /^Strength score 18/ }),
    ).toBeInTheDocument();
    expect(
      within(strength).getByRole('button', { name: 'Roll Strength check, +4' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Roll Strength save, +7' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Roll Athletics, +7' })).toBeInTheDocument();
    for (const section of ['Combat', 'Health', 'Senses', 'Defenses', 'Proficiencies']) {
      expect(screen.getByRole('region', { name: section })).toBeInTheDocument();
    }
    expect(screen.getByText('Poison')).toBeInTheDocument();
    // The quick builder leaves picks the fixture can't fill.
    expect(screen.getByRole('button', { name: /Needs attention/ })).toBeInTheDocument();
  });

  it('rolls a d20 test with its bonus', async () => {
    const user = userEvent.setup();
    renderApp(`/c/${character.id}/main`, fixedRng([face(15, 20)]));
    await user.click(await screen.findByRole('button', { name: 'Roll Athletics, +7' }));
    const rolls = screen.getByRole('status', { name: 'Rolls' });
    expect(
      within(rolls).getByRole('button', { name: 'Athletics: 22. Dismiss' }),
    ).toBeInTheDocument();
    expect(within(rolls).getByText('1d20 (15) + 7')).toBeInTheDocument();
  });

  it('takes damage and heals from the HP keypad, and saves it', async () => {
    const user = userEvent.setup();
    renderApp(`/c/${character.id}/main`);
    // The header pill and the Health card both open the keypad.
    const [pill] = await screen.findAllByRole('button', { name: hp(50) });
    await user.click(pill!);
    await user.click(await screen.findByRole('button', { name: '1' }));
    await user.click(screen.getByRole('button', { name: '2' }));
    expect(screen.getByLabelText('Amount')).toHaveTextContent('12');
    await user.click(screen.getByRole('button', { name: 'Damage' }));
    expect(await screen.findAllByRole('button', { name: hp(38) })).toHaveLength(2);
    await saved();
    expect((await stored(character.id)).state.damage).toBe(12);

    await user.click(screen.getAllByRole('button', { name: hp(38) })[0]!);
    await user.click(await screen.findByRole('button', { name: '5' }));
    await user.click(screen.getByRole('button', { name: 'Heal' }));
    expect(await screen.findAllByRole('button', { name: hp(43) })).toHaveLength(2);
  });

  it('spends hit dice from the Health tiles, keeping focus at the limit', async () => {
    const user = userEvent.setup();
    renderApp(`/c/${character.id}/main`);
    const increase = await screen.findByRole('button', { name: /^Increase d\d+ hit dice left/ });
    expect(increase).toHaveAttribute('aria-disabled', 'true');
    const decrease = screen.getByRole('button', { name: /^Decrease d\d+ hit dice left/ });
    await user.click(decrease);
    await user.click(increase);
    expect(increase).toHaveFocus();
    await user.click(decrease);
    await saved();
    expect(Object.values((await stored(character.id)).state.hitDiceUsed)).toEqual([1]);
  });

  it('shows death saves at 0 HP and saves their marks', async () => {
    const user = userEvent.setup();
    await repos().characters.save({ ...character, state: { ...character.state, damage: 50 } }, 2);
    renderApp(`/c/${character.id}/main`);
    const successes = await screen.findByRole('group', { name: 'Successes' });
    await user.click(within(successes).getByRole('button', { name: 'Success 1' }));
    await user.click(
      within(screen.getByRole('group', { name: 'Failures' })).getByRole('button', {
        name: 'Failure 2',
      }),
    );
    await saved();
    expect((await stored(character.id)).state.deathSaves).toEqual({ successes: 1, failures: 2 });
  });

  it('explains a number and takes an override, then removes it', async () => {
    const user = userEvent.setup();
    renderApp(`/c/${character.id}/main`);
    await user.click(await screen.findByRole('button', { name: /^Armor Class 11, show/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Armor Class' });
    expect(within(dialog).getByLabelText('Total 11')).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Your own value'), '19');
    await user.click(within(dialog).getByRole('button', { name: 'Use this' }));
    expect(
      await screen.findByRole('button', { name: /^Armor Class 19, show/ }),
    ).toBeInTheDocument();
    await saved();
    expect((await stored(character.id)).overrides).toEqual({ ac: 19 });

    await user.click(screen.getByRole('button', { name: /^Armor Class 19, show/ }));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Armor Class' })).getByRole('button', {
        name: 'Remove',
      }),
    );
    expect(
      await screen.findByRole('button', { name: /^Armor Class 11, show/ }),
    ).toBeInTheDocument();
  });

  it('adds and removes a condition, and toggles Heroic Inspiration', async () => {
    const user = userEvent.setup();
    renderApp(`/c/${character.id}/main`);
    await user.click(await screen.findByRole('button', { name: '+ Condition' }));
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Add a condition' })).getByRole('button', {
        name: 'Dazzled',
      }),
    );
    expect(await screen.findByRole('button', { name: 'Remove Dazzled' })).toBeInTheDocument();
    // Also shown in the header.
    expect(within(screen.getByRole('banner')).getByText('Dazzled')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove Dazzled' }));
    expect(screen.queryByRole('button', { name: 'Remove Dazzled' })).not.toBeInTheDocument();

    const inspiration = screen.getByRole('button', { name: /Inspiration/ });
    expect(inspiration).toHaveAttribute('aria-pressed', 'false');
    await user.click(inspiration);
    expect(inspiration).toHaveAttribute('aria-pressed', 'true');
    await saved();
    expect((await stored(character.id)).state.heroicInspiration).toBe(true);
  });
});

describe('Actions tab', () => {
  it('shows the attacks and the standard actions', async () => {
    renderApp(`/c/${character.id}/actions`);
    const attacks = await screen.findByRole('region', { name: 'Attacks' });
    expect(within(attacks).getByRole('listitem', { name: 'Unarmed Strike' })).toBeInTheDocument();
    expect(screen.getByText('Standard actions')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Actions' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('Inventory tab', () => {
  it('adds an item from the library; its content loads into the sheet', async () => {
    const user = userEvent.setup();
    renderApp(`/c/${character.id}/inventory`);
    expect(await screen.findByRole('region', { name: 'Carrying' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Add an item' }));
    await user.type(await dialog.findByRole('searchbox', { name: 'Find an item' }), 'sack');
    await user.click(await dialog.findByRole('button', { name: /^Sack of Holding/ }));
    await user.click(dialog.getByRole('button', { name: 'Add' }));
    const sack = await screen.findByRole('listitem', { name: 'Sack of Holding' });
    // Its weight comes from the content, loaded once the character holds it.
    expect(await within(sack).findByText('5 lb.')).toBeInTheDocument();
  });
});

describe('a character without a class', () => {
  it('shows the plain header and a note', async () => {
    const empty = await repos().characters.save({ ...character, id: 'empty', log: [] });
    renderApp(`/c/${empty.id}/main`);
    const main = await screen.findByRole('tabpanel', { name: 'Main' });
    expect(within(main).getByText('This character has no class yet.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Grosh' })).toBeInTheDocument();
  });
});
