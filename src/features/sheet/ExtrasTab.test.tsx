import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../db/db.ts';
import type { ContentIndex } from '../../engine/content/contentIndex.ts';
import { derive } from '../../engine/derive/derive.ts';
import type { Character } from '../../schema/index.ts';
import { testCharacter } from '../../test/characters.ts';
import { FIXTURE_FEATURE_EFFECTS } from '../../test/fixtureFeatureEffects.ts';
import { fixtureIndex } from '../../test/fixtureIndex.ts';
import { seedFixtureContent } from '../../test/seedContent.ts';
import { SheetProvider } from '../../ui/BottomSheet.tsx';
import { RollerProvider } from '../../ui/Roller.tsx';
import { ExtrasTab } from './ExtrasTab.tsx';
import type { CharacterUpdate } from './useCharacterActions.ts';

let index: ContentIndex;
beforeAll(async () => {
  index = await fixtureIndex();
});
beforeEach(async () => {
  await resetDb('test-extras');
  await seedFixtureContent(['TST']);
});

let latest: Character;

function Harness({ initial }: { initial: Character }) {
  const ref = useRef(initial);
  const [character, setCharacter] = useState(initial);
  const sheet = derive(character, index, { registry: FIXTURE_FEATURE_EFFECTS });
  const apply = (update: CharacterUpdate) => {
    ref.current = update(ref.current);
    latest = ref.current;
    setCharacter(ref.current);
  };
  return <ExtrasTab character={character} sheet={sheet} index={index} apply={apply} />;
}

const renderTab = (c: Character) =>
  render(
    <RollerProvider>
      <SheetProvider>
        <Harness initial={c} />
      </SheetProvider>
    </RollerProvider>,
  );

const lorekeeper = () => {
  const c = testCharacter({
    name: 'Ada',
    classes: [{ classId: 'lorekeeper|tst', levels: 5 }],
    scores: { int: 16 },
  });
  c.state.prepared['lorekeeper|tst'] = ['rolling boom|tst'];
  return c;
};

const wanderer = (levels: number) =>
  testCharacter({
    name: 'Bree',
    classes: [{ classId: 'wanderer|tst', levels }],
    scores: { wis: 14 },
  });

const dialog = () => within(screen.getByRole('dialog'));

describe('Extras tab: companions', () => {
  it('adds a summon from the character’s spells, works out its numbers and tracks its HP', async () => {
    const user = userEvent.setup();
    renderTab(lorekeeper());
    expect(screen.getByText(/No companions yet/)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Beast Form' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Add' }));
    const suggested = await dialog().findByRole('list', { name: 'Suggested creatures' });
    expect(
      within(suggested)
        .getAllByRole('button')
        .map((b) => b.querySelector('span')?.textContent),
    ).toEqual(['Boom Spirit', 'Boom Spirit (Air)']);
    await user.click(within(suggested).getByRole('button', { name: /Boom Spirit \(Air\)/ }));
    await user.selectOptions(dialog().getByRole('combobox', { name: 'Spell level' }), '5');
    await user.click(dialog().getByRole('button', { name: 'Add' }));

    expect(latest.extras).toMatchObject([{ name: 'Boom Spirit (Air)', spellLevel: 5 }]);
    const card = within(screen.getByRole('listitem', { name: 'Boom Spirit (Air)' }));
    // 11 + the spell's level; 20 + 10 for each level above 3.
    expect(card.getByText('16')).toBeInTheDocument();
    await user.click(card.getByRole('button', { name: /hit points 40 of 40/ }));
    await user.click(dialog().getByRole('button', { name: '1' }));
    await user.click(dialog().getByRole('button', { name: '2' }));
    await user.click(dialog().getByRole('button', { name: 'Damage' }));
    expect(latest.extras?.[0]?.damage).toBe(12);
    expect(card.getByRole('button', { name: /hit points 28 of 40/ })).toBeInTheDocument();

    // The stat block, with the summoner's attack, damage and DC in.
    await user.click(card.getByRole('button', { name: 'Boom Spirit (Air)' }));
    const block = dialog();
    expect(block.getByText('+6')).toBeInTheDocument();
    expect(block.getByText('1d8 + 7')).toBeInTheDocument();
    expect(block.getByText(/DC 14/)).toBeInTheDocument();
    expect(block.getByText(/2 at level 5/)).toBeInTheDocument();
    expect(block.getByText('(20 + 10 for each spell level above 3)')).toBeInTheDocument();
  });

  it('a summon whose HP depends on its form asks for a maximum; one can be written in', async () => {
    const user = userEvent.setup();
    renderTab(lorekeeper());
    await user.click(screen.getByRole('button', { name: 'Add' }));
    const suggested = await dialog().findByRole('list', { name: 'Suggested creatures' });
    await user.click(within(suggested).getByRole('button', { name: /^Boom Spirit ?Medium/ }));
    await user.click(dialog().getByRole('button', { name: 'Add' }));
    const card = within(screen.getByRole('listitem', { name: 'Boom Spirit' }));
    expect(card.getByText('set a maximum below')).toBeInTheDocument();
    await user.type(card.getByRole('textbox', { name: 'HP maximum' }), '30');
    expect(latest.extras?.[0]?.hpMax).toBe(30);
    expect(card.getByRole('button', { name: /hit points 30 of 30/ })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.click(await dialog().findByRole('button', { name: 'Write one in' }));
    await user.type(dialog().getByRole('textbox', { name: 'Name' }), 'Pip');
    await user.type(dialog().getByRole('textbox', { name: 'HP maximum' }), '5');
    await user.click(dialog().getByRole('button', { name: 'Add' }));
    expect(latest.extras?.[1]).toMatchObject({ name: 'Pip', hpMax: 5 });

    await user.click(card.getByRole('button', { name: 'Remove Boom Spirit' }));
    expect(latest.extras?.map((e) => e.name)).toEqual(['Pip']);
  });

  it('finds any creature by name; a class companion scales with the class level', async () => {
    const user = userEvent.setup();
    renderTab(wanderer(5));
    await user.click(screen.getByRole('button', { name: 'Add' }));
    const suggested = await dialog().findByRole('list', { name: 'Suggested creatures' });
    expect(within(suggested).getAllByRole('button')).toHaveLength(1);
    await user.type(dialog().getByRole('searchbox', { name: 'Find a creature' }), 'moth');
    expect(dialog().getByRole('list', { name: 'Creatures found' })).toHaveTextContent(
      'Glimmer Moth',
    );
    await user.clear(dialog().getByRole('searchbox', { name: 'Find a creature' }));
    await user.click(within(suggested).getByRole('button', { name: /Trail Hound/ }));
    expect(dialog().queryByRole('combobox', { name: 'Spell level' })).toBeNull();
    await user.click(dialog().getByRole('button', { name: 'Add' }));
    const card = within(screen.getByRole('listitem', { name: 'Trail Hound' }));
    // 13 + Wisdom +2; 5 + five times the Wanderer level.
    expect(card.getByText('15')).toBeInTheDocument();
    expect(card.getByRole('button', { name: /hit points 30 of 30/ })).toBeInTheDocument();
  });
});

describe('Extras tab: Wild Shape', () => {
  it('picks known forms within the limits, takes one and shows what stays yours', async () => {
    const user = userEvent.setup();
    renderTab(wanderer(4));
    const section = within(screen.getByRole('region', { name: 'Beast Form' }));
    expect(
      section.getByText('Known forms 0 of 3 · up to CR 1/2 · no Fly Speed · 2 of 2 uses left', {
        exact: false,
      }),
    ).toBeInTheDocument();
    expect(section.getByText(/gives you 4 temporary HP/)).toBeInTheDocument();

    await user.click(section.getByRole('button', { name: 'Choose forms' }));
    const beasts = await dialog().findByRole('list', { name: 'Beasts' });
    const names = within(beasts)
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(names.some((n) => n?.includes('Storm Hawk'))).toBe(false);
    expect(names.some((n) => n?.includes('Swarm of Gnats'))).toBe(false);
    await user.click(within(beasts).getByRole('button', { name: /Moss Boar CR 1\/4/ }));
    await user.click(within(beasts).getByRole('button', { name: /Cliff Goat/ }));
    expect(latest.wildShapeForms).toEqual(['moss boar|tst', 'cliff goat|tst']);
    expect(dialog().getByText(/Known forms 2 of 3/)).toBeInTheDocument();
    await user.click(dialog().getByRole('checkbox', { name: /Show every Beast/ }));
    expect(
      within(beasts).getByRole('button', { name: /Storm Hawk.*CR 1 is over 1\/2/ }),
    ).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(section.getByRole('button', { name: 'Take the form of Moss Boar' }));
    expect(latest.state.activeToggles['wild-shape']).toEqual({ option: 'moss boar|tst' });
    expect(latest.state.tempHp).toBe(4);
    const inForm = within(section.getByRole('region', { name: 'In Wild Shape' }));
    expect(inForm.getByText('In a form: Moss Boar')).toBeInTheDocument();
    const keeps = within(inForm.getByLabelText('Your own numbers'));
    expect(keeps.getByText(/Wisdom 14 \(\+2\)/)).toBeInTheDocument();
    expect(inForm.getByText('11 (natural armor)')).toBeInTheDocument();

    await user.click(inForm.getByRole('button', { name: 'Leave the form' }));
    expect(latest.state.activeToggles['wild-shape']).toBeUndefined();
  });
});
