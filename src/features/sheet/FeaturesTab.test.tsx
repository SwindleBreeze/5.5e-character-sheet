import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../db/db.ts';
import type { ContentIndex } from '../../engine/content/contentIndex.ts';
import { derive } from '../../engine/derive/derive.ts';
import { encodeChoiceKey, type Character, type ChoiceKey } from '../../schema/index.ts';
import { testCharacter } from '../../test/characters.ts';
import { FIXTURE_FEATURE_EFFECTS } from '../../test/fixtureFeatureEffects.ts';
import { fixtureIndex } from '../../test/fixtureIndex.ts';
import { seedFixtureContent } from '../../test/seedContent.ts';
import { SheetProvider } from '../../ui/BottomSheet.tsx';
import { RollerProvider } from '../../ui/Roller.tsx';
import { FeaturesTab } from './FeaturesTab.tsx';
import type { CharacterUpdate } from './useCharacterActions.ts';

let index: ContentIndex;
beforeAll(async () => {
  index = await fixtureIndex();
});
beforeEach(async () => {
  await resetDb('test-features');
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
  return <FeaturesTab character={character} sheet={sheet} index={index} apply={apply} />;
}

const renderTab = (c: Character) =>
  render(
    <RollerProvider>
      <SheetProvider>
        <Harness initial={c} />
      </SheetProvider>
    </RollerProvider>,
  );

const gladiator = { kind: 'class', id: 'gladiator|tst' } as const;
const veteran = { kind: 'feat', id: 'arena veteran|tst' } as const;

/** Gladiator 4 (School of the Net) with a fighting style, two tricks and Arena Veteran. */
const character = () =>
  testCharacter({
    classes: [{ classId: 'gladiator|tst', levels: 4, subclassId: 'net|gladiator|tst|tst' }],
    speciesId: 'mossling|tst',
    backgroundId: 'arena hand|tst',
    choices: [
      { owner: gladiator, slot: 'skills', values: ['athletics', 'performance'] },
      {
        owner: gladiator,
        slot: 'featProgression.arena-style.1',
        values: ['net style|tst'],
        valueKinds: ['feat'],
      },
      {
        owner: gladiator,
        slot: 'optfeat.crowd-tricks.2',
        values: ['taunt|tst', 'encore|tst'],
        valueKinds: ['optionalFeature'],
        atLevel: 2,
      },
      {
        owner: { kind: 'classFeature', id: 'ability score improvement|gladiator|tst|4|tst' },
        slot: 'feat',
        values: [veteran.id],
        valueKinds: ['feat'],
        atLevel: 4,
      },
    ],
  });

const section = (name: string) => within(screen.getByRole('region', { name }));
const row = (name: string) => screen.getByRole('listitem', { name });

function recordOf(c: Character, key: ChoiceKey) {
  const encoded = encodeChoiceKey(key);
  for (const [entry, e] of c.log.entries()) {
    const record = e.choices.find((r) => encodeChoiceKey(r.key) === encoded);
    if (record) return { entry, record };
  }
  return undefined;
}

describe('Features tab', () => {
  it('groups features by where they come from, with picks and counters at a glance', () => {
    renderTab(character());
    const cls = section('Gladiator 4');
    expect(cls.getByRole('listitem', { name: 'Showmanship' })).toBeTruthy();
    expect(cls.getByRole('listitem', { name: 'Ability Score Improvement' })).toBeTruthy();

    // Picks of the class, named after the progression they belong to.
    const picks = within(within(row('Gladiator')).getByRole('list', { name: 'Gladiator choices' }));
    expect(picks.getByText('Athletics, Performance')).toBeTruthy();
    expect(picks.getByText('Net Style')).toBeTruthy();
    // The level 6 style isn't offered yet at level 4.
    expect(picks.queryByText('Arena Style (level 6)')).toBeNull();
    expect(picks.getByText('Taunt, Encore')).toBeTruthy();
    expect(picks.getByText('Crowd Tricks (level 4)')).toBeTruthy();
    // On the row's badge and on the pick.
    expect(within(row('Gladiator')).getAllByText('1 to choose')).toHaveLength(2);

    // The subclass is listed once; Tangle, written inside its first feature, isn't a row.
    const sub = section('School of the Net (Gladiator)');
    expect(sub.getAllByRole('listitem', { name: 'School of the Net' })).toHaveLength(1);
    expect(sub.queryByRole('listitem', { name: 'Tangle' })).toBeNull();

    expect(section('Feats').getByText(/from Ability Score Improvement/)).toBeTruthy();
    expect(section('Feats').getByText(/from Gladiator \(Arena Style\)/)).toBeTruthy();
    expect(section('Crowd Tricks').getByRole('listitem', { name: 'Taunt' })).toBeTruthy();
    expect(section('Species').getByRole('listitem', { name: 'Mossling' })).toBeTruthy();
    expect(section('Background').getByRole('listitem', { name: 'Arena Hand' })).toBeTruthy();

    // At a glance: how it is used, from its text.
    expect(row('Showmanship').querySelector('[data-kind="glance"]')?.textContent).toBe(
      'Bonus Action',
    );

    // A counter, spent in place.
    expect(within(row('Arena Training')).getByRole('group', { name: /left$/ })).toBeTruthy();
  });

  it('opens a feature to read its text', async () => {
    const user = userEvent.setup();
    renderTab(character());
    const showmanship = within(row('Showmanship'));
    await user.click(showmanship.getByRole('button', { name: 'Showmanship' }));
    expect(
      showmanship.getByRole('button', { name: 'Showmanship' }).getAttribute('aria-expanded'),
    ).toBe('true');
  });

  it('makes a pick that is still to make, in the entry it belongs to', async () => {
    const user = userEvent.setup();
    renderTab(character());
    await user.click(
      within(row('Arena Veteran')).getByRole('button', {
        name: 'Choose Ability Score Increase (Arena Veteran)',
      }),
    );
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText(/rules don’t let you change this later/)).toBeTruthy();
    await user.click(await dialog.findByRole('radio', { name: 'Charisma' }));
    expect(dialog.getByText('1 of 1 chosen')).toBeTruthy();
    await user.click(dialog.getByRole('button', { name: 'Save' }));
    expect(recordOf(latest, { owner: veteran, slot: 'ability' })).toEqual({
      entry: 3,
      record: expect.objectContaining({ values: ['cha'], labels: ['Charisma'], via: 'levelUp' }),
    });
  });

  it('marks what the character has already and keeps the count, unless rules are ignored', async () => {
    const user = userEvent.setup();
    renderTab(character());
    await user.click(
      within(row('Arena Veteran')).getByRole('button', { name: 'Choose Skills (Arena Veteran)' }),
    );
    const dialog = within(await screen.findByRole('dialog'));
    const athletics = await dialog.findByRole('radio', { name: /Athletics/ });
    expect(dialog.getAllByText(/have it already/i)).toHaveLength(2);
    await user.click(athletics);
    expect((athletics as HTMLInputElement).checked).toBe(false);
    await user.click(dialog.getByRole('checkbox', { name: /Ignore rules/ }));
    await user.click(dialog.getByRole('checkbox', { name: /Athletics/ }));
    await user.click(dialog.getByRole('checkbox', { name: /Performance/ }));
    expect(dialog.getByText('2 of 1 chosen')).toBeTruthy();
    await user.click(dialog.getByRole('button', { name: 'Save' }));
    expect(recordOf(latest, { owner: veteran, slot: 'skills' })?.record.values).toEqual([
      'athletics',
      'performance',
    ]);
  });

  it('changes a pick as a retrain, saying when the rules allow it', async () => {
    const user = userEvent.setup();
    const mastery = {
      owner: { kind: 'classFeature', id: 'weapon mastery|brute|tst|1|tst' },
      slot: 'mastery',
    } as const;
    renderTab(
      testCharacter({
        classes: [{ classId: 'brute|tst', levels: 1 }],
        choices: [{ ...mastery, values: ['net blade|tst', 'shiv|tst'], valueKinds: ['item'] }],
      }),
    );
    const picks = within(row('Weapon Mastery'));
    expect(picks.getByText('Net Blade, Shiv')).toBeTruthy();
    await user.click(picks.getByRole('button', { name: 'Change Weapon Mastery (Weapon Mastery)' }));
    const dialog = within(await screen.findByRole('dialog'));
    expect(dialog.getByText(/whenever you finish a Long Rest/)).toBeTruthy();
    await user.click(await dialog.findByRole('checkbox', { name: 'Shiv' }));
    await user.click(dialog.getByRole('checkbox', { name: 'Walking Staff' }));
    await user.click(dialog.getByRole('button', { name: 'Save' }));
    expect(recordOf(latest, mastery)).toEqual({
      entry: 0,
      record: expect.objectContaining({
        values: ['net blade|tst', 'walking staff|tst'],
        labels: ['Net Blade', 'Walking Staff'],
        via: 'retrain',
      }),
    });
  });

  it('a picked feat’s own choices open below it, inline', async () => {
    const user = userEvent.setup();
    renderTab(character());
    const asi = within(row('Ability Score Improvement'));
    await user.click(asi.getByRole('button', { name: 'Change Feat (Ability Score Improvement)' }));
    const dialog = within(await screen.findByRole('dialog'));
    // Prerequisites are shown; the fixture's General feat needs level 4 and STR or CHA 13.
    expect(await dialog.findByText(/Prerequisite: Level 4\+/)).toBeTruthy();
    // An Origin feat: listed with Ignore rules.
    expect(dialog.queryByRole('radio', { name: 'Spark Initiate' })).toBeNull();
    await user.click(dialog.getByRole('checkbox', { name: 'Ignore rules' }));
    await user.click(dialog.getByRole('checkbox', { name: 'Arena Veteran' }));
    await user.click(dialog.getByRole('checkbox', { name: 'Spark Initiate' }));
    await user.click(dialog.getByRole('button', { name: 'Save' }));
    // Spark Initiate asks for a spellcasting ability and two cantrips.
    expect(await dialog.findByText(/comes with choices of its own/)).toBeTruthy();
    const ability = within(dialog.getByRole('region', { name: 'Spellcasting ability' }));
    await user.click(ability.getByRole('radio', { name: 'Intelligence' }));
    const spark = { kind: 'feat', id: 'spark initiate|tst' } as const;
    expect(recordOf(latest, { owner: spark, slot: 'spells.0.ability' })?.record).toMatchObject({
      values: ['int'],
      via: 'levelUp',
    });
    // The feat it replaced took its picks with it.
    expect(recordOf(latest, { owner: veteran, slot: 'skills' })).toBeUndefined();
    await user.click(dialog.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('adds a gift, tracks its uses and removes it once used up', async () => {
    const user = userEvent.setup();
    renderTab(character());
    expect(section('Gifts').getByText(/No gifts/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Add gift' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Add a gift' }));
    await user.type(await dialog.findByRole('searchbox', { name: 'Find a gift' }), 'embers');
    await user.click(await dialog.findByRole('button', { name: 'Add Charm of Embers' }));
    expect(
      recordOf(latest, { owner: { kind: 'reward', id: 'charm of embers|tst' }, slot: 'granted' })
        ?.record.via,
    ).toBe('manual');

    const charm = within(row('Charm of Embers'));
    const counter = charm.getByRole('group', { name: 'Charges left' });
    expect(within(counter).getByText('3')).toBeTruthy();
    for (let i = 0; i < 3; i++)
      await user.click(charm.getByRole('button', { name: 'Decrease Charges left' }));
    expect(charm.getByText('Used up')).toBeTruthy();

    await user.click(charm.getByRole('button', { name: 'Charm of Embers' }));
    await user.click(charm.getByRole('button', { name: 'Remove' }));
    await user.click(charm.getByRole('button', { name: 'Remove Charm of Embers' }));
    expect(screen.queryByRole('listitem', { name: 'Charm of Embers' })).toBeNull();
    expect(latest.state.resourcesUsed).toEqual({});
  });
});
