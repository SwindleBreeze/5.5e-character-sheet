import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ContentIndex } from '../../engine/content/contentIndex.ts';
import type { Rng } from '../../engine/dice/roll.ts';
import { derive } from '../../engine/derive/derive.ts';
import type { FeatureEffectsMap } from '../../engine/featureEffects/types.ts';
import type { Character, Effect, InventoryItem } from '../../schema/index.ts';
import { testCharacter } from '../../test/characters.ts';
import { FIXTURE_FEATURE_EFFECTS } from '../../test/fixtureFeatureEffects.ts';
import { fixtureIndex } from '../../test/fixtureIndex.ts';
import { face, fixedRng } from '../../test/rng.ts';
import { SheetProvider } from '../../ui/BottomSheet.tsx';
import { RollerProvider } from '../../ui/Roller.tsx';
import { ActionsTab } from './ActionsTab.tsx';
import type { CharacterUpdate } from './useCharacterActions.ts';

let index: ContentIndex;
beforeAll(async () => {
  index = await fixtureIndex();
});

let last: Character;

function Harness({ initial, registry }: { initial: Character; registry: FeatureEffectsMap }) {
  const latest = useRef(initial);
  const [character, setCharacter] = useState(initial);
  const sheet = derive(character, index, { registry });
  const apply = (update: CharacterUpdate) => {
    latest.current = update(latest.current);
    last = latest.current;
    setCharacter(latest.current);
  };
  return <ActionsTab character={character} sheet={sheet} index={index} apply={apply} />;
}

function renderTab(character: Character, rng?: Rng, registry = FIXTURE_FEATURE_EFFECTS) {
  return render(
    <RollerProvider rng={rng}>
      <SheetProvider>
        <Harness initial={character} registry={registry} />
      </SheetProvider>
    </RollerProvider>,
  );
}

/** The fixture mappings plus test-only effects added to one feature. */
function withEffects(feature: string, effects: Effect[]): FeatureEffectsMap {
  const base = FIXTURE_FEATURE_EFFECTS[feature]!;
  return {
    ...FIXTURE_FEATURE_EFFECTS,
    [feature]: { ...base, effects: [...base.effects, ...effects] },
  };
}

const row = (id: string, equipped?: InventoryItem['equipped']) => ({
  itemRef: { kind: 'item', id } as const,
  name: id.split('|')[0],
  ...(equipped ? { equipped } : {}),
});

/** Brute 5 (STR 18, PB +3): Net Blade in hand, a Shiv stowed. */
const brute = (
  inventory: Partial<InventoryItem>[] = [row('net blade|tst', 'mainHand'), row('shiv|tst')],
) =>
  testCharacter({
    classes: [{ classId: 'brute|tst', levels: 5 }],
    scores: { str: 18, dex: 13, con: 14, int: 8, wis: 10, cha: 10 },
    inventory,
  });

const card = (name: string) => screen.getByRole('listitem', { name });
const rolls = () => screen.getByRole('status', { name: 'Rolls' });
type User = ReturnType<typeof userEvent.setup>;
/** Open a part of the turn: Action, Bonus, Reaction or Other. */
const part = (user: User, name: string) =>
  user.click(screen.getByRole('tab', { name: new RegExp(`^${name}`) }));
/** Unfold an attack's details (properties, mastery, rules). */
const more = (user: User, name: string) =>
  user.click(within(card(name)).getByRole('button', { name: `${name}: more details` }));
/** The limited-use counters, in their sheet. */
async function limited(user: User) {
  await user.click(screen.getByRole('button', { name: /^Limited use/ }));
  return within(await screen.findByRole('dialog', { name: 'Limited use' }));
}

describe('Actions tab', () => {
  it('lists attacks in hand, the Unarmed Strike, then stowed weapons, each with how it is made', async () => {
    const user = userEvent.setup();
    renderTab(brute());
    const attacks = within(screen.getByRole('tabpanel', { name: 'Turn: Actions' }));
    expect(attacks.getAllByRole('listitem').map((li) => li.getAttribute('aria-label'))).toEqual([
      'net blade',
      'Unarmed Strike',
      'shiv',
    ]);
    expect(within(card('net blade')).getByText('Attack action')).toBeInTheDocument();
    expect(within(card('net blade')).getByText('Melee 5 ft. · STR')).toBeInTheDocument();
    // The other hand is free, so it can be swung two-handed.
    expect(
      within(card('net blade')).getByRole('button', {
        name: /^Roll net blade damage with two hands, 1d10 \+ 4/,
      }),
    ).toBeInTheDocument();

    const shiv = within(card('shiv'));
    expect(shiv.getByText('Stowed')).toBeInTheDocument();
    // Its properties and rules are a tap away.
    expect(shiv.queryByRole('button', { name: 'Light' })).toBeNull();
    await more(user, 'shiv');
    expect(shiv.getByText('Melee 5 ft. · Thrown 20/60 ft. · STR')).toBeInTheDocument();
    expect(
      shiv.getByText(
        /draw it as part of an attack with the Attack action \(one weapon per attack\), or as part of throwing it/,
      ),
    ).toBeInTheDocument();
    expect(shiv.getByRole('button', { name: 'Light' })).toBeInTheDocument();

    await more(user, 'Unarmed Strike');
    const strike = within(card('Unarmed Strike'));
    expect(strike.getByText(/against DC/).textContent).toContain('DC 15');
    expect(screen.getByRole('button', { name: '2 per Attack action' })).toBeInTheDocument();
  });

  it('a weapon whose mastery the character uses says what the mastery does', async () => {
    const user = userEvent.setup();
    const c = testCharacter({
      classes: [{ classId: 'brute|tst', levels: 5 }],
      scores: { str: 18, dex: 13, con: 14, int: 8, wis: 10, cha: 10 },
      inventory: [row('net blade|tst', 'mainHand'), row('shiv|tst')],
      choices: [
        {
          owner: { kind: 'classFeature', id: 'weapon mastery|brute|tst|1|tst' },
          slot: 'mastery',
          values: ['net blade|tst'],
          valueKinds: ['item'],
        },
      ],
    });
    renderTab(c);
    // Folded, it is named; unfolded, it says what it does.
    expect(within(card('net blade')).getByText(/Mastery: Snare/)).toBeInTheDocument();
    await more(user, 'net blade');
    await more(user, 'shiv');
    const blade = card('net blade');
    expect(blade.querySelector('[data-kind="mastery"]')?.textContent).toBe(
      'Weapon mastery: SnareThe target is slowed.',
    );
    expect(
      within(blade).getByRole('button', { name: 'Weapon mastery: Snare' }),
    ).toBeInTheDocument();
    // The Shiv's mastery isn't one the character has.
    expect(card('shiv').querySelector('[data-kind="mastery"]')).toBeNull();
  });

  it('rolling for a stowed weapon draws it into the free hand', async () => {
    const user = userEvent.setup();
    renderTab(brute());
    await user.click(within(card('shiv')).getByRole('button', { name: /^Roll shiv: to hit/ }));
    expect(last.inventory.map((r) => r.equipped)).toEqual(['mainHand', 'offHand']);
    expect(within(card('shiv')).queryByText('Stowed')).not.toBeInTheDocument();
  });

  it('rolls to hit; a natural 20 marks a Critical Hit, which doubles the damage dice', async () => {
    const user = userEvent.setup();
    renderTab(brute(), fixedRng([face(20, 20), face(5, 8), face(3, 8)]));
    const blade = within(card('net blade'));
    await user.click(blade.getByRole('button', { name: 'Roll net blade: to hit, +7' }));
    expect(
      within(rolls()).getByRole('button', { name: 'net blade: to hit: 27. Dismiss' }),
    ).toHaveAttribute('data-natural', 'crit');
    // Where the +7 comes from, with the result.
    expect(within(rolls()).getByText('STR modifier +4 · Proficiency +3')).toBeInTheDocument();
    expect(blade.getByRole('button', { name: 'Critical hit' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(blade.getByRole('button', { name: /^Roll net blade damage, 1d8 \+ 4/ }));
    expect(
      within(rolls()).getByRole('button', {
        name: 'net blade: damage, critical hit (slashing): 12. Dismiss',
      }),
    ).toBeInTheDocument();
    expect(within(rolls()).getByText('2d8 (5 + 3) + 4')).toBeInTheDocument();
    // The next hit is a normal one again.
    expect(blade.getByRole('button', { name: 'Critical hit' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('an opt-in once-per-turn rider adds its dice, is marked used, and End turn clears it', async () => {
    const user = userEvent.setup();
    const c = testCharacter({
      classes: [{ classId: 'pactbinder|tst', levels: 2 }],
      scores: { str: 8, dex: 12, con: 12, int: 10, wis: 10, cha: 16 },
      inventory: [row('shiv|tst', 'mainHand')],
    });
    renderTab(c, fixedRng([face(2, 4), face(6, 6)]));
    const shiv = within(card('shiv'));
    const hex = shiv.getByRole('button', { name: /^Hex Strike/ });
    expect(hex).toHaveTextContent('Hex Strike +1d6 necrotic · once per turn');
    await user.click(hex);
    expect(hex).toHaveAttribute('aria-pressed', 'true');
    await user.click(shiv.getByRole('button', { name: /^Roll shiv damage, 1d4 \+ 1/ }));
    expect(
      within(rolls()).getByRole('button', {
        name: 'shiv: damage (piercing, necrotic): 9. Dismiss',
      }),
    ).toBeInTheDocument();
    expect(hex).toHaveAttribute('aria-pressed', 'false');
    expect(hex).toHaveTextContent('used this turn');

    await user.click(screen.getByRole('button', { name: 'End turn' }));
    expect(hex).toHaveTextContent('once per turn');
    expect(screen.queryByRole('button', { name: 'End turn' })).not.toBeInTheDocument();
  });

  it('uses a feature action: pays its cost, rolls its healing where it can be seen', async () => {
    const user = userEvent.setup();
    const c = brute();
    c.state.damage = 30;
    renderTab(c, fixedRng([face(4, 8)]));
    await part(user, 'Bonus');
    const bonus = within(screen.getByRole('tabpanel', { name: 'Turn: Bonus Actions' }));
    const breath = within(bonus.getByRole('listitem', { name: 'Catch Breath' }));
    expect(breath.getByText(/^Costs/)).toHaveTextContent('Costs 1 Catch Breath (2 left)');
    expect(breath.getByText('Regain 1d8 + 5 Hit Points')).toBeInTheDocument();

    await user.click(breath.getByRole('button', { name: 'Use' }));
    expect(
      within(rolls()).getByRole('button', { name: 'Catch Breath: healing: 9. Dismiss' }),
    ).toBeInTheDocument();
    expect(breath.getByText(/^Costs/)).toHaveTextContent('Costs 1 Catch Breath (1 left)');

    await user.click(breath.getByRole('button', { name: 'Use' }));
    const use = breath.getByRole('button', { name: 'Use' });
    expect(use).toHaveAttribute('aria-disabled', 'true');
    expect(use).toHaveFocus();
    expect(breath.getByText('No uses left')).toBeInTheDocument();
    await user.click(use);
    expect(screen.getByRole('button', { name: /^Limited use/ })).toHaveTextContent(
      'Catch Breath 0/2',
    );
    expect(
      (await limited(user)).getByRole('group', { name: 'Catch Breath left' }),
    ).toHaveTextContent('0 / 2');
  });

  it('turns a toggle on (paying for it) and off; spends and restores a counter', async () => {
    const user = userEvent.setup();
    renderTab(brute());
    // Switching Fury on takes a Bonus Action: it is under Bonus.
    await part(user, 'Bonus');
    const fury = () => within(card('Fury'));
    expect(fury().getByText(/^Costs/)).toHaveTextContent('Costs 1 Furies (3 left), a Bonus Action');
    // Where the 3 comes from.
    expect(card('Fury')).toHaveTextContent(
      'Furies: 3 uses, the Furies column of your class table. Recharge: Long Rest.',
    );
    expect(fury().getByText('Ends on a Long Rest.')).toBeInTheDocument();
    await user.click(fury().getByRole('button', { name: 'Turn on Fury' }));
    expect(fury().getByText('On')).toBeInTheDocument();
    // Fury adds its damage to Strength melee attacks.
    await part(user, 'Action');
    expect(
      within(card('net blade')).getByRole('button', { name: /^Roll net blade damage, 1d8 \+ 5/ }),
    ).toBeInTheDocument();
    await part(user, 'Bonus');
    await user.click(fury().getByRole('button', { name: 'Turn off Fury' }));
    expect(fury().queryByText('On')).not.toBeInTheDocument();

    const counter = (await limited(user)).getByRole('group', { name: 'Furies left' });
    expect(counter).toHaveTextContent('2 / 3');
    await user.click(within(counter).getByRole('button', { name: 'Increase Furies left' }));
    expect(counter).toHaveTextContent('3 / 3');
    await user.click(within(counter).getByRole('button', { name: 'Decrease Furies left' }));
    expect(counter).toHaveTextContent('2 / 3');
  });

  it('the actions everyone has; Opportunity Attack under Reaction, with what it can use', async () => {
    const user = userEvent.setup();
    renderTab(brute());
    const action = within(screen.getByRole('tabpanel', { name: 'Turn: Actions' }));
    expect(action.getByText('One Action on your turn: one of these.')).toBeInTheDocument();
    expect(action.getByRole('button', { name: 'Dash' })).toBeInTheDocument();
    expect(action.queryByRole('button', { name: 'Opportunity Attack' })).toBeNull();

    await part(user, 'Reaction');
    const reaction = within(screen.getByRole('tabpanel', { name: 'Turn: Reactions' }));
    expect(reaction.getByText(/One Reaction per round/)).toBeInTheDocument();
    // A stowed weapon can't be drawn for an Opportunity Attack.
    expect(reaction.getByText(/one melee attack, net blade, Unarmed Strike\./)).toBeInTheDocument();
    expect(reaction.getByRole('button', { name: 'Opportunity Attack' })).toBeInTheDocument();
  });

  it('each part of the turn has its tab; an empty one says so', async () => {
    const user = userEvent.setup();
    renderTab(brute([row('net blade|tst', 'mainHand')]));
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      expect.stringMatching(/^Action\d+$/),
      expect.stringMatching(/^Bonus\d+$/),
      expect.stringMatching(/^Reaction\d+$/),
      expect.stringMatching(/^Other\d+$/),
    ]);
    await part(user, 'Bonus');
    expect(screen.getByText(/One Bonus Action on your turn/)).toBeInTheDocument();
    await part(user, 'Other');
    expect(screen.getByRole('tabpanel', { name: 'Turn: Other' })).toBeInTheDocument();
  });

  it('a potion is drunk as a Bonus Action: one is used up and its healing rolled', async () => {
    const user = userEvent.setup();
    const c = brute([
      row('net blade|tst', 'mainHand'),
      { ...row('draught of mending|tst'), uid: 'p', quantity: 2 },
    ]);
    c.state.damage = 20;
    renderTab(c, fixedRng([face(3, 4), face(4, 4)]));
    expect(screen.queryByRole('button', { name: 'Drink Draught of Mending' })).toBeNull();
    await part(user, 'Bonus');
    const potions = within(screen.getByRole('tabpanel', { name: 'Turn: Bonus Actions' }));
    expect(potions.getByText('Heals 2d4 + 2')).toBeInTheDocument();
    await user.click(potions.getByRole('button', { name: 'Drink Draught of Mending' }));
    expect(last.inventory.find((r) => r.uid === 'p')?.quantity).toBe(1);
    expect(last.state.damage).toBe(11);
    // On 2014 rules it takes an action.
  });

  it('on 2014 rules a potion is drunk as an action', () => {
    const c = {
      ...brute([row('net blade|tst', 'mainHand'), { ...row('draught of mending|tst'), uid: 'p' }]),
      ruleset: '2014' as const,
    };
    renderTab(c);
    expect(
      within(screen.getByRole('tabpanel', { name: 'Turn: Actions' })).getByRole('button', {
        name: 'Drink Draught of Mending',
      }),
    ).toBeInTheDocument();
  });

  it('a spell-slot cost asks which slot, then pays it', async () => {
    const user = userEvent.setup();
    const registry = withEffects('classFeature:lore recovery|lorekeeper|tst|1|tst', [
      {
        type: 'grantAction',
        action: {
          id: 'arcane-jolt',
          name: 'Arcane Jolt',
          actionType: 'bonus',
          costs: [{ slot: { minLevel: 2 } }],
          outcomes: [{ tempHp: 3 }],
        },
      },
    ]);
    const c = testCharacter({
      classes: [
        { classId: 'lorekeeper|tst', levels: 5 },
        { classId: 'pactbinder|tst', levels: 2 },
      ],
      scores: { int: 16 },
    });
    renderTab(c, undefined, registry);
    await part(user, 'Bonus');
    const jolt = within(card('Arcane Jolt'));
    expect(jolt.getByText(/^Costs/)).toHaveTextContent('Costs a level 2+ spell slot');
    await user.click(jolt.getByRole('button', { name: 'Use' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Arcane Jolt' }));
    // A level 1 Pact Magic slot is too small for a level 2+ cost.
    expect(dialog.getAllByRole('radio').map((r) => r.closest('label')!.textContent)).toEqual([
      'Level 2 slot2 left',
      'Level 3 slot1 left',
    ]);
    await user.click(dialog.getByRole('radio', { name: /Level 3 slot/ }));
    await user.click(dialog.getByRole('button', { name: 'Use Arcane Jolt' }));
    expect(last.state.slotsUsed).toEqual([0, 0, 1]);
    expect(last.state.tempHp).toBe(3);
  });

  it('a Hit Dice cost spends one with a single die size, no question asked', async () => {
    const user = userEvent.setup();
    const registry = withEffects('classFeature:catch breath|brute|tst|2|tst', [
      {
        type: 'grantAction',
        action: {
          id: 'steel-breath',
          name: 'Steel Breath',
          actionType: 'bonus',
          costs: [{ hitDice: 1 }],
          outcomes: [{ tempHp: 2 }],
        },
      },
    ]);
    renderTab(brute(), undefined, registry);
    await part(user, 'Bonus');
    await user.click(within(card('Steel Breath')).getByRole('button', { name: 'Use' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(Object.values(last.state.hitDiceUsed)).toEqual([1]);
  });

  it('a rider with a cost pays it when it is added to the damage roll', async () => {
    const user = userEvent.setup();
    const registry = withEffects('classFeature:fury|brute|tst|1|tst', [
      {
        type: 'damageRider',
        id: 'rend',
        name: 'Rend',
        dice: '1d6',
        damageType: 'slashing',
        filter: { range: 'melee' },
        optIn: true,
        cost: { resource: 'furies', amount: 1 },
      },
    ]);
    renderTab(brute(), fixedRng([face(1, 8), face(1, 6)]), registry);
    const blade = within(card('net blade'));
    const rend = blade.getByRole('button', { name: /^Rend/ });
    expect(rend).toHaveTextContent('costs 1 Furies');
    await user.click(rend);
    await user.click(blade.getByRole('button', { name: /^Roll net blade damage, 1d8/ }));
    expect(last.state.resourcesUsed['classFeature:fury|brute|tst|1|tst#furies']).toBe(1);
  });

  it('ammunition: each attack roll expends a piece, magic ammunition adds its bonus, half comes back', async () => {
    const user = userEvent.setup();
    renderTab(
      brute([
        row('arc bow|tst', 'bothHands'),
        { ...row('arrow|tst'), uid: 'arrows', name: 'Arrow', quantity: 4 },
        {
          ...row('arrow|tst'),
          uid: 'magic',
          name: '+1 Arrow',
          quantity: 2,
          variantRef: { kind: 'item', id: '+1 arena ammunition|tst' },
        },
      ]),
      fixedRng([face(10, 20)]),
    );
    const bow = within(card('arc bow'));
    const hit = () => bow.getByRole('button', { name: /^Roll arc bow: to hit/ });
    const plain = hit().getAttribute('aria-label')!;
    await user.click(hit());
    await user.click(hit());
    expect(last.inventory.find((r) => r.uid === 'arrows')?.quantity).toBe(2);

    // +1 Arrows: +1 to hit and to damage.
    await user.selectOptions(bow.getByRole('combobox', { name: 'Ammunition' }), 'magic');
    expect(hit().getAttribute('aria-label')).not.toBe(plain);
    expect(
      bow.getByRole('button', { name: 'Roll arc bow damage, 1d6 + 2 piercing' }),
    ).toBeInTheDocument();
    await user.click(hit());
    expect(last.state.ammoUsed).toEqual({ arrows: 2, magic: 1 });

    await user.click(bow.getByRole('button', { name: 'Recover 1' }));
    expect(last.inventory.map((r) => r.quantity)).toEqual([1, 3, 1]);
    expect(last.state.ammoUsed).toBeUndefined();
  });

  it('no ammunition, and Loading with no hand free to load', async () => {
    const user = userEvent.setup();
    renderTab(brute([row('wrist bow|tst', 'mainHand'), row('buckler|tst', 'shield')]));
    await more(user, 'wrist bow');
    const bow = within(card('wrist bow'));
    expect(bow.getByText(/No Arrow ammunition/)).toBeInTheDocument();
    expect(bow.getByText('Loading it needs a free hand, and neither is free.')).toBeInTheDocument();
    expect(bow.getByText(/^Loading: you fire only one piece of ammunition/)).toBeInTheDocument();
  });
});
