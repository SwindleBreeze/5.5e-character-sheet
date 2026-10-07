import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../db/db.ts';
import type { ContentIndex } from '../../engine/content/contentIndex.ts';
import type { Rng } from '../../engine/dice/roll.ts';
import { derive } from '../../engine/derive/derive.ts';
import type { Character, InventoryItem } from '../../schema/index.ts';
import { testCharacter } from '../../test/characters.ts';
import { FIXTURE_FEATURE_EFFECTS } from '../../test/fixtureFeatureEffects.ts';
import { fixtureIndex } from '../../test/fixtureIndex.ts';
import { face, fixedRng } from '../../test/rng.ts';
import { seedFixtureContent } from '../../test/seedContent.ts';
import { SheetProvider } from '../../ui/BottomSheet.tsx';
import { RollerProvider } from '../../ui/Roller.tsx';
import { InventoryTab } from './InventoryTab.tsx';
import type { CharacterUpdate } from './useCharacterActions.ts';

let index: ContentIndex;
beforeAll(async () => {
  index = await fixtureIndex();
});
beforeEach(async () => {
  await resetDb('test-inventory');
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
  return <InventoryTab character={character} sheet={sheet} index={index} apply={apply} />;
}

const renderTab = (c: Character, rng?: Rng) =>
  render(
    <RollerProvider rng={rng}>
      <SheetProvider>
        <Harness initial={c} />
      </SheetProvider>
    </RollerProvider>,
  );

const item = (id: string) => ({ kind: 'item', id }) as const;
const row = (
  uid: string,
  id: string,
  extra: Partial<InventoryItem> = {},
): Partial<InventoryItem> => ({
  uid,
  itemRef: item(id),
  name: index.get(item(id))?.name ?? id,
  ...extra,
});

/** Brute 1, STR 12: light and medium armor and Bucklers. */
const brute = (inventory: Partial<InventoryItem>[]) => {
  const c = testCharacter({
    classes: [{ classId: 'brute|tst', levels: 1 }],
    scores: { str: 12, dex: 14 },
    inventory,
  });
  c.currency = { cp: 0, sp: 0, ep: 0, gp: 15, pp: 0 };
  return c;
};

const rowNamed = (name: string) => screen.getByRole('listitem', { name });
const open = async (user: ReturnType<typeof userEvent.setup>, name: string) =>
  user.click(within(rowNamed(name)).getByRole('button', { name: new RegExp(`^${name}`) }));

describe('Inventory tab', () => {
  it('weight against capacity, what is worn and held, and containers with their contents', () => {
    renderTab(
      brute([
        row('blade', 'net blade|tst', { equipped: 'mainHand' }),
        row('pack', 'backpack|tst'),
        row('torches', 'torch|tst', { quantity: 2, containerUid: 'pack' }),
      ]),
    );
    // Net Blade 3 + Backpack 5 + 2 torches; 15 coins weigh 0.3 lb.
    expect(screen.getByRole('button', { name: '10.3 lb.' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '180 lb. you can carry' })).toBeInTheDocument();
    expect(screen.getByText(/Attuned to/)).toHaveTextContent('Attuned to 0 of 3 magic items.');

    const held = screen.getByRole('list', { name: 'Worn and held' });
    expect(within(held).getByRole('listitem', { name: 'Net Blade' })).toHaveTextContent(
      'Main hand',
    );
    const pack = within(screen.getByRole('list', { name: 'Carried' })).getByRole('listitem', {
      name: 'Backpack',
    });
    expect(pack).toHaveTextContent('2/30 lb. inside');
    expect(within(pack).getByRole('list', { name: 'In Backpack' })).toHaveTextContent('Torch ×2');
  });

  it('equipping: a Shield frees a hand, armor without training warns', async () => {
    const user = userEvent.setup();
    renderTab(
      brute([
        row('blade', 'net blade|tst', { equipped: 'bothHands' }),
        row('buckler', 'buckler|tst'),
        row('mail', 'arena mail|tst'),
      ]),
    );
    await open(user, 'Buckler');
    // Its rules text shows as the row opens.
    expect(within(rowNamed('Buckler')).getByText('Armor class')).toBeInTheDocument();
    await user.selectOptions(
      within(rowNamed('Buckler')).getByRole('combobox', { name: 'Worn or held' }),
      'shield',
    );
    // The Versatile Net Blade moves to the main hand.
    expect(latest.inventory.map((r) => r.equipped)).toEqual(['mainHand', 'shield', undefined]);

    await open(user, 'Arena Mail');
    const mail = within(rowNamed('Arena Mail'));
    expect(
      mail.getByText('Heavy armor takes 10 minutes to don and 5 minutes to doff.'),
    ).toBeInTheDocument();
    await user.selectOptions(mail.getByRole('combobox', { name: 'Worn or held' }), 'armor');
    expect(screen.getByRole('list', { name: 'Inventory warnings' })).toHaveTextContent(
      'You lack heavy armor training for your Arena Mail',
    );
  });

  it('holding one of a stack: its details stay open, and more of it go to Carried', async () => {
    const user = userEvent.setup();
    renderTab(brute([row('shivs', 'shiv|tst', { quantity: 2 })]));
    await open(user, 'Shiv');
    await user.selectOptions(
      within(rowNamed('Shiv')).getByRole('combobox', { name: 'Worn or held' }),
      'mainHand',
    );
    const held = within(
      within(screen.getByRole('list', { name: 'Worn and held' })).getByRole('listitem', {
        name: 'Shiv',
      }),
    );
    expect(
      held.getByText('Worn and held items are one each: more go to Carried.'),
    ).toBeInTheDocument();
    await user.click(held.getByRole('button', { name: /Increase Shiv quantity/ }));
    expect(latest.inventory.map((r) => [r.quantity, r.equipped ?? '-'])).toEqual([
      [1, 'mainHand'],
      [2, '-'],
    ]);
  });

  it('Attunement: the prerequisite and the limit', async () => {
    const user = userEvent.setup();
    renderTab(
      brute([
        row('echo', 'shiv|tst', {
          name: 'Shiv of Echoes',
          variantRef: item('echo weapon|tst'),
          chargesMax: 2,
        }),
        row('cloak', 'cloak of cheers|tst'),
      ]),
    );
    await open(user, 'Shiv of Echoes');
    const echo = within(rowNamed('Shiv of Echoes'));
    expect(
      echo.getByText(/Requires Attunement by a gladiator\. You don’t meet its prerequisite\./),
    ).toBeInTheDocument();
    await user.click(echo.getByRole('checkbox', { name: 'Attuned' }));
    expect(latest.inventory[0]?.attuned).toBe(false);

    await open(user, 'Cloak of Cheers');
    await user.click(
      within(rowNamed('Cloak of Cheers')).getByRole('checkbox', { name: 'Attuned' }),
    );
    expect(latest.inventory[1]?.attuned).toBe(true);
    expect(screen.getByText(/Attuned to/)).toHaveTextContent('Attuned to 1 of 3 magic items.');
  });

  it('charges: spend, then regain the rolled amount', async () => {
    const user = userEvent.setup();
    renderTab(
      brute([
        row('echo', 'shiv|tst', {
          name: 'Shiv of Echoes',
          variantRef: item('echo weapon|tst'),
          chargesMax: 3,
          chargesUsed: 3,
        }),
      ]),
      fixedRng([face(2, 3)]),
    );
    expect(rowNamed('Shiv of Echoes')).toHaveTextContent('0/3 charges');
    await open(user, 'Shiv of Echoes');
    const echo = within(rowNamed('Shiv of Echoes'));
    expect(echo.getByText('Regains 1d3 charges at dawn.')).toBeInTheDocument();
    await user.click(echo.getByRole('button', { name: 'Regain 1d3' }));
    expect(latest.inventory[0]?.chargesUsed).toBe(1);
  });

  it('coins: pay with change, receive, and refuse too much', async () => {
    const user = userEvent.setup();
    renderTab(brute([]));
    expect(screen.getByText(/^Worth/)).toHaveTextContent('Worth 15 GP · 15 coins, 0.3 lb.');
    await user.type(screen.getByRole('textbox', { name: 'Coin amount' }), '25');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Coin' }), 'sp');
    await user.click(screen.getByRole('button', { name: 'Pay' }));
    expect(latest.currency).toEqual({ cp: 0, sp: 5, ep: 0, gp: 12, pp: 0 });

    await user.type(screen.getByRole('textbox', { name: 'Coin amount' }), '20');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Coin' }), 'gp');
    await user.click(screen.getByRole('button', { name: 'Pay' }));
    expect(screen.getByRole('alert')).toHaveTextContent('That’s 20 GP; you have 12.5 GP.');
    await user.click(screen.getByRole('button', { name: 'Receive' }));
    expect(latest.currency.gp).toBe(32);

    const copper = screen.getByRole('textbox', { name: 'Copper pieces' });
    await user.clear(copper);
    await user.type(copper, '40{Enter}');
    expect(latest.currency.cp).toBe(40);
  });

  it('adds a base item with a magic variant, and a variant on a base item', async () => {
    const user = userEvent.setup();
    renderTab(brute([]), fixedRng([face(2, 3)]));
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Add an item' }));
    await user.type(await dialog.findByRole('searchbox', { name: 'Find an item' }), 'net');
    await user.click(await dialog.findByRole('button', { name: /^Net Blade/ }));
    // Net Blade is a 2024 item: the classic "+1 Old Weapon" isn't offered.
    const variants = dialog.getByRole('combobox', { name: 'Magic variant' });
    expect(
      within(variants)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['None', '+1 Arena Weapon (TST)', 'Echo Weapon (TST)']);
    await user.selectOptions(variants, '+1 arena weapon|tst');
    await user.click(dialog.getByRole('button', { name: 'Add' }));
    expect(latest.inventory.at(-1)).toMatchObject({
      name: '+1 Net Blade',
      itemRef: item('net blade|tst'),
      variantRef: item('+1 arena weapon|tst'),
    });

    await user.click(screen.getByRole('button', { name: 'Add item' }));
    const again = within(await screen.findByRole('dialog', { name: 'Add an item' }));
    await user.type(await again.findByRole('searchbox', { name: 'Find an item' }), 'echo');
    await user.click(await again.findByRole('button', { name: /^Echo Weapon/ }));
    const bases = again.getByRole('combobox', { name: 'Base item' });
    expect(
      within(bases)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Choose one (3)', 'Net Blade (TST)', 'Shiv (TST)', 'Walking Staff (TST)']);
    await user.selectOptions(bases, 'shiv|tst');
    await user.click(again.getByRole('button', { name: 'Add' }));
    // Its charges are dice, rolled when it is added.
    expect(latest.inventory.at(-1)).toMatchObject({ name: 'Shiv of Echoes', chargesMax: 2 });
  });

  it('adds a custom item, and unpacks a pack into its backpack', async () => {
    const user = userEvent.setup();
    renderTab(brute([row('kit', "delver's kit|tst")]));
    await open(user, "Delver's Kit");
    await user.click(within(rowNamed("Delver's Kit")).getByRole('button', { name: 'Unpack' }));
    expect(
      latest.inventory.map((r) => [r.name, r.quantity, r.containerUid ? 'in' : 'out']),
    ).toEqual([
      ['Backpack', 1, 'out'],
      ['Torch', 2, 'in'],
    ]);

    await user.click(screen.getByRole('button', { name: 'Add item' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Add an item' }));
    // The sheet says "Loading items…" until the library has loaded.
    await user.click(await dialog.findByRole('button', { name: 'Custom item' }));
    await user.type(dialog.getByRole('textbox', { name: 'Name' }), 'Lucky coin');
    await user.type(dialog.getByRole('textbox', { name: 'Weight (lb. each)' }), '0.1');
    await user.click(dialog.getByRole('button', { name: 'Add' }));
    expect(latest.inventory.at(-1)).toMatchObject({
      name: 'Lucky coin',
      quantity: 1,
      custom: { weightLb: 0.1 },
    });
  });
});
