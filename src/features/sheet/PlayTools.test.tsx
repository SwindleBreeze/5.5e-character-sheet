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

/** Brute 5 (50 HP, 5d12), built the way the quick builder does, with changes before saving. */
async function savedBrute(change: (c: Character) => void = () => {}): Promise<Character> {
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
  change(c);
  return repos().characters.save(c, 1);
}

const stored = async (id: string) => (await repos().characters.get(id))!;
const saved = () => act(() => new Promise((r) => setTimeout(r, SAVE_DELAY_MS + 50)));

async function openMore(user: ReturnType<typeof userEvent.setup>, item: string) {
  await user.click(await screen.findByRole('button', { name: /^More: rests/ }));
  const menu = within(await screen.findByRole('dialog', { name: 'More' }));
  await user.click(menu.getByRole('button', { name: new RegExp(`^${item}`) }));
  return within(await screen.findByRole('dialog', { name: item }));
}

beforeEach(async () => {
  await resetDb('test-play');
  await seedFixtureContent(['TST']);
});

describe('play tools', () => {
  it('a Long Rest lists what comes back, then says what came back', async () => {
    const user = userEvent.setup();
    const c = await savedBrute((c) => {
      c.state.damage = 20;
      c.state.hitDiceUsed = { 12: 2 };
      c.state.exhaustion = 1;
    });
    renderApp(`/c/${c.id}/main`);
    const rest = await openMore(user, 'Long Rest');
    expect(rest.getByText('Hit Points: 20 back (full)')).toBeTruthy();
    expect(rest.getByText('Hit Dice: 2 d12 back')).toBeTruthy();
    expect(rest.getByText('Exhaustion ends')).toBeTruthy();
    await user.click(rest.getByRole('button', { name: 'Finish Long Rest' }));
    expect(rest.getByText(/You finished a Long Rest/)).toBeTruthy();
    await saved();
    expect((await stored(c.id)).state).toMatchObject({ damage: 0, hitDiceUsed: {}, exhaustion: 0 });
  });

  it('a Short Rest spends Hit Dice one at a time, rolled with real dice and typed in', async () => {
    const user = userEvent.setup();
    const c = await savedBrute((c) => {
      c.state.damage = 30;
    });
    renderApp(`/c/${c.id}/main`);
    const rest = await openMore(user, 'Short Rest');
    await user.click(rest.getByRole('radio', { name: 'I roll my own dice' }));
    await user.type(rest.getByRole('textbox', { name: 'Your d12 roll' }), '7');
    await user.click(rest.getByRole('button', { name: 'Spend a d12' }));
    expect(rest.getByText('d12: 4 of 5 left')).toBeTruthy();
    // 7 + the CON modifier.
    const healed = rest.getByText(/^Hit Points: \d+ back/).textContent!;
    const back = Number(/(\d+) back/.exec(healed)![1]);
    await user.click(rest.getByRole('button', { name: 'Finish Short Rest' }));
    // What was spent and what came back, apart.
    expect(rest.getByRole('region', { name: 'You spent' })).toHaveTextContent(
      'Hit Dice: 1 d12 (4 of 5 left)',
    );
    expect(rest.getByRole('region', { name: 'You got back' })).toHaveTextContent(
      `Hit Points: ${back} back`,
    );
    await saved();
    expect((await stored(c.id)).state).toMatchObject({ damage: 30 - back, hitDiceUsed: { 12: 1 } });
  });

  it('the dice roller rolls any dice, with advantage, and keeps the last rolls', async () => {
    const user = userEvent.setup();
    const c = await savedBrute();
    renderApp(`/c/${c.id}/main`, fixedRng([face(4, 6), face(5, 6), face(3, 20), face(17, 20)]));
    const dice = await openMore(user, 'Dice roller');
    await user.type(dice.getByRole('textbox', { name: 'Dice' }), '2d6+3');
    await user.click(dice.getByRole('button', { name: 'Roll' }));
    await user.click(dice.getByRole('radio', { name: 'Advantage' }));
    await user.click(dice.getByRole('button', { name: 'd20' }));
    const last = within(dice.getByRole('list', { name: 'Last rolls' }));
    expect(last.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '1d20 · Adv2d20 (3, 17 → 17)17',
      '2d6+32d6 (4 + 5) + 312',
    ]);
    await user.clear(dice.getByRole('textbox', { name: 'Dice' }));
    await user.type(dice.getByRole('textbox', { name: 'Dice' }), 'two dice');
    await user.click(dice.getByRole('button', { name: 'Roll' }));
    expect(dice.getByText(/Can't read/)).toBeTruthy();
  });

  it('damage while concentrating asks for the save; losing it ends the effect', async () => {
    const user = userEvent.setup();
    const c = await savedBrute((c) => {
      c.state.concentration = { kind: 'spell', id: 'dim lantern|tst' };
    });
    renderApp(`/c/${c.id}/main`);
    expect(await screen.findByRole('button', { name: 'Concentrating: Dim Lantern' })).toBeTruthy();
    const [pill] = await screen.findAllByRole('button', { name: /^Hit points 50 of 50/ });
    await user.click(pill!);
    await user.click(await screen.findByRole('button', { name: '2' }));
    await user.click(screen.getByRole('button', { name: '4' }));
    await user.click(screen.getByRole('button', { name: 'Damage' }));
    const prompt = within(await screen.findByRole('dialog', { name: 'Concentration' }));
    expect(prompt.getByText('DC').parentElement).toHaveTextContent('DC12');
    await user.click(prompt.getByRole('button', { name: 'Lost it' }));
    await saved();
    expect((await stored(c.id)).state).toMatchObject({ damage: 24, concentration: null });
    expect(screen.queryByRole('button', { name: /^Concentrating/ })).toBeNull();
  });

  it('lists the overrides and removes one; sets the character’s own sources', async () => {
    const user = userEvent.setup();
    const c = await savedBrute((c) => {
      c.overrides.ac = 20;
    });
    renderApp(`/c/${c.id}/main`);
    const overrides = await openMore(user, 'Overrides');
    expect(overrides.getByText('Armor Class:')).toBeTruthy();
    await user.click(overrides.getByRole('button', { name: 'Remove the override of Armor Class' }));
    expect(overrides.getByText(/No overrides/)).toBeTruthy();
    await saved();
    expect((await stored(c.id)).overrides).toEqual({});

    await user.click(screen.getByRole('button', { name: 'Close' }));
    const sources = await openMore(user, 'Sources');
    await user.click(sources.getByRole('radio', { name: 'Choose for this character' }));
    await saved();
    expect((await stored(c.id)).enabledSources).toEqual(['TST']);
    await user.click(sources.getByRole('radio', { name: /Use the app’s sources/ }));
    await saved();
    expect((await stored(c.id)).enabledSources).toBeNull();
  });
});
