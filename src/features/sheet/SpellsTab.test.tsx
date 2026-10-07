import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../db/db.ts';
import { createCatalog, type Catalog } from '../../engine/build/catalog.ts';
import { quickBuild } from '../../engine/build/quickBuild.ts';
import type { ContentIndex } from '../../engine/content/contentIndex.ts';
import { derive } from '../../engine/derive/derive.ts';
import type { Character, ContentEntity } from '../../schema/index.ts';
import { FIXTURE_FEATURE_EFFECTS } from '../../test/fixtureFeatureEffects.ts';
import { fixtureContent } from '../../test/fixtureIndex.ts';
import { seedFixtureContent } from '../../test/seedContent.ts';
import { SheetProvider } from '../../ui/BottomSheet.tsx';
import { RollerProvider } from '../../ui/Roller.tsx';
import { SpellsTab } from './SpellsTab.tsx';
import type { CharacterUpdate } from './useCharacterActions.ts';

let index: ContentIndex;
let catalog: Catalog;

beforeAll(async () => {
  const content = await fixtureContent();
  index = content.index;
  catalog = createCatalog(
    Object.values(content.entities).flat() as ContentEntity[],
    new Set(['TST']),
  );
});

beforeEach(async () => {
  await resetDb('test-spells');
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
  return <SpellsTab character={character} sheet={sheet} index={index} apply={apply} />;
}

const renderTab = (c: Character) =>
  render(
    <RollerProvider>
      <SheetProvider>
        <Harness initial={c} />
      </SheetProvider>
    </RollerProvider>,
  );

/** Lorekeeper 5 (a Wizard-like spellbook caster) / Pactbinder 2 (Pact Magic). */
const duo = () =>
  quickBuild(
    {
      name: 'Duo',
      speciesId: 'mossling|tst',
      backgroundId: 'arena hand|tst',
      classes: [
        { classId: 'lorekeeper|tst', levels: 5 },
        { classId: 'pactbinder|tst', levels: 2 },
      ],
    },
    { index, catalog, registry: FIXTURE_FEATURE_EFFECTS, now: 0 },
  );

const slots = (name: string) => screen.getByRole('group', { name: `${name} slots` });
describe('Spells tab', () => {
  it('shows each caster, the slots and Pact Magic apart, and spells by level', () => {
    renderTab(duo());
    const lore = within(screen.getByRole('region', { name: 'Lorekeeper' }));
    expect(lore.getByText('13')).toBeInTheDocument();
    expect(
      lore.getByRole('button', { name: 'Roll Lorekeeper spell attack, +5' }),
    ).toBeInTheDocument();
    expect(lore.getByText(/any number of prepared spells/)).toBeInTheDocument();
    expect(lore.getByRole('button', { name: 'Change prepared' })).toBeInTheDocument();

    const pact = within(screen.getByRole('region', { name: 'Pactbinder' }));
    expect(
      pact.getByText('You change one prepared spell when you gain a level.'),
    ).toBeInTheDocument();
    expect(pact.queryByRole('button', { name: 'Change prepared' })).not.toBeInTheDocument();

    expect(slots('Level 1')).toHaveTextContent('4/4 left');
    expect(slots('Level 3')).toHaveTextContent('1/1 left');
    expect(slots('Pact Magic, level 1')).toHaveTextContent(
      '2/2 left · Back on a Short or Long Rest',
    );

    expect(screen.getByRole('list', { name: 'Spells: Cantrips' })).toHaveTextContent('Spark Bolt');
    const lantern = within(screen.getByRole('listitem', { name: 'Dim Lantern' }));
    expect(lantern.getByTitle('Concentration')).toBeInTheDocument();
    expect(lantern.getByTitle('Ritual')).toBeInTheDocument();
    // Whether it calls for a spell attack or a save.
    expect(lantern.getByText(/Bonus Action · spell attack · Lorekeeper/)).toBeInTheDocument();
    expect(
      within(screen.getByRole('listitem', { name: 'Rolling Boom' })).getByText(/DEX save/),
    ).toBeInTheDocument();
  });

  it('expends and restores slots with the pips', async () => {
    const user = userEvent.setup();
    renderTab(duo());
    const level1 = within(slots('Level 1'));
    await user.click(level1.getAllByRole('button', { name: 'Level 1: expend a slot' })[0]!);
    expect(slots('Level 1')).toHaveTextContent('3/4 left');
    expect(latest.state.slotsUsed[0]).toBe(1);
    await user.click(level1.getByRole('button', { name: 'Level 1: restore a slot' }));
    expect(slots('Level 1')).toHaveTextContent('4/4 left');
  });

  it('casts with a higher slot: one per turn, Concentration replaced and shown', async () => {
    const user = userEvent.setup();
    renderTab(duo());
    await user.click(screen.getByRole('button', { name: 'Dim Lantern' }));
    expect(
      await screen.findByText(
        'Prepared as a Lorekeeper spell: cast with a spell slot of its level or higher.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/It calls for a ranged spell attack/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Roll Dim Lantern: spell attack, +5' }),
    ).toBeInTheDocument();
    const ways = within(await screen.findByRole('group', { name: 'Cast Dim Lantern' }));
    expect(ways.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Level 1 slot (4 left)',
      'Level 2 slot (2 left) · cast at level 2',
      'Level 3 slot (1 left) · cast at level 3',
      'Pact Magic slot, level 1 (2 left)',
      'As a Ritual (10 minutes longer, no slot)',
    ]);
    await user.click(ways.getByRole('button', { name: /^Level 2 slot/ }));
    expect(slots('Level 2')).toHaveTextContent('1/2 left');
    // A notice says what casting it did.
    expect(
      within(screen.getByRole('status', { name: 'Rolls' })).getByRole('button', {
        name: 'Cast Dim Lantern: Level 2 slot expended, 1 left · cast at level 2 · Concentrating. Dismiss',
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('listitem', { name: 'Dim Lantern' })).getByText('Concentrating'),
    ).toBeInTheDocument();
    const concentration = screen.getByRole('status', { name: 'Concentration' });
    expect(concentration).toHaveTextContent('Concentrating on Dim Lantern');
    expect(screen.getByRole('status', { name: 'This turn' })).toBeInTheDocument();

    // Mind Ward needs Concentration too: casting it would end Dim Lantern's.
    await user.click(screen.getByRole('button', { name: 'Mind Ward' }));
    expect(
      await screen.findByText('Casting it ends your Concentration on Dim Lantern.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/You already expended a spell slot this turn/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Level 3 slot/ }));
    expect(screen.getByRole('status', { name: 'Concentration' })).toHaveTextContent(
      'Concentrating on Mind Ward',
    );

    await user.click(
      within(screen.getByRole('status', { name: 'This turn' })).getByRole('button', {
        name: 'End turn',
      }),
    );
    expect(screen.queryByRole('status', { name: 'This turn' })).not.toBeInTheDocument();
    await user.click(
      within(screen.getByRole('status', { name: 'Concentration' })).getByRole('button', {
        name: 'End',
      }),
    );
    expect(screen.queryByRole('status', { name: 'Concentration' })).not.toBeInTheDocument();
  });

  it('casts from the list in one tap, with the lowest slot (plan step 4C.5)', async () => {
    const user = userEvent.setup();
    renderTab(duo());
    const row = within(screen.getByRole('listitem', { name: 'Dim Lantern' }));
    await user.click(row.getByRole('button', { name: 'Cast Dim Lantern: Level 1 slot (4 left)' }));
    expect(slots('Level 1')).toHaveTextContent('3/4 left');
    expect(latest.state.concentration).toEqual({ kind: 'spell', id: 'dim lantern|tst' });
    // No sheet opened.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('copies a spell into the spellbook, its cost said (plan step 5.6)', async () => {
    const user = userEvent.setup();
    // The fixture's few spells are all in the book: take one out so there is one to copy.
    const c = duo();
    const record = c.log
      .flatMap((e) => e.choices)
      .find((r) => r.key.slot.startsWith('spellbook.'))!;
    record.values.pop();
    record.labels.pop();
    renderTab(c);
    const card = within(screen.getByRole('region', { name: 'Lorekeeper' }));
    const count = () =>
      Number(
        /\((\d+)\)/.exec(
          card.getByRole('button', { name: /^Spellbook/, hidden: true }).textContent!,
        )![1],
      );
    const before = count();
    await user.click(card.getByRole('button', { name: 'Add to spellbook' }));
    const sheet = within(
      await screen.findByRole('dialog', { name: 'Lorekeeper: add to spellbook' }),
    );
    const row = (await sheet.findAllByRole('listitem'))[0]!;
    expect(row).toHaveTextContent(/\d+ hours · \d+ GP/);
    await user.click(within(row).getByRole('button', { name: 'Copy' }));
    expect(count()).toBe(before + 1);
    expect(latest.log.at(-1)!.choices.at(-1)).toMatchObject({
      key: { slot: 'spellbook.copied' },
      via: 'manual',
    });
  });

  it('lists the cantrip picks to change, with when the rules allow it', async () => {
    const user = userEvent.setup();
    renderTab(duo());
    const card = within(screen.getByRole('region', { name: 'Lorekeeper' }));
    await user.click(card.getByRole('button', { name: 'Change cantrips' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Lorekeeper: cantrips' }));
    expect(sheet.getByRole('listitem', { name: 'Level 1 cantrips' })).toBeInTheDocument();
  });

  it('a Ritual costs no slot', async () => {
    const user = userEvent.setup();
    renderTab(duo());
    await user.click(screen.getByRole('button', { name: 'Dim Lantern' }));
    await user.click(await screen.findByRole('button', { name: /^As a Ritual/ }));
    expect(latest.state.slotsUsed.every((n) => !n)).toBe(true);
    expect(latest.state.turn.slotSpent).toBeUndefined();
    expect(latest.state.concentration).toEqual({ kind: 'spell', id: 'dim lantern|tst' });
  });

  it('changes prepared spells; the spellbook keeps the rest, castable only as Rituals', async () => {
    const user = userEvent.setup();
    renderTab(duo());
    // The whole book, opened under its caster, even with every spell in it prepared.
    await user.click(screen.getByRole('button', { name: 'Spellbook (4)' }));
    const book = () => screen.getByRole('region', { name: 'Lorekeeper spellbook' });
    expect(within(book()).getAllByRole('listitem')).toHaveLength(4);
    expect(within(book()).queryByText('Not prepared')).not.toBeInTheDocument();

    await user.click(
      within(screen.getByRole('region', { name: 'Lorekeeper' })).getByRole('button', {
        name: 'Change prepared',
      }),
    );
    const dialog = within(
      await screen.findByRole('dialog', { name: 'Lorekeeper: prepared spells' }),
    );
    expect(await dialog.findByText('4 / 7 prepared')).toBeInTheDocument();
    // Only spellbook spells are offered (Hex Mark is a Pactbinder spell).
    expect(dialog.queryByLabelText(/Hex Mark/)).not.toBeInTheDocument();
    await user.click(dialog.getByRole('checkbox', { name: /Dim Lantern/ }));
    await user.click(dialog.getByRole('checkbox', { name: /Rolling Boom/ }));
    expect(dialog.getByText('2 / 7 prepared')).toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: 'Save' }));
    expect(latest.state.prepared['lorekeeper|tst']).toEqual(['ink cloud|tst', 'mind ward|tst']);

    expect(
      within(book())
        .getAllByRole('listitem')
        .filter((li) => within(li).queryByText('Not prepared'))
        .map((li) => li.getAttribute('aria-label')),
    ).toEqual(['Dim Lantern', 'Rolling Boom']);
    await user.click(within(book()).getByRole('button', { name: 'Dim Lantern' }));
    expect(
      within(await screen.findByRole('group', { name: 'Cast Dim Lantern' }))
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['As a Ritual (10 minutes longer, no slot)']);
  });

  it('the spell attack and save DC say what they are and where they come from', async () => {
    const user = userEvent.setup();
    renderTab(duo());
    const lore = within(screen.getByRole('region', { name: 'Lorekeeper' }));
    await user.click(lore.getByRole('button', { name: 'Spell attack' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Lorekeeper: spell attack' }));
    expect(
      sheet.getByText(/calls for a spell attack, roll a d20 and add this bonus/),
    ).toBeInTheDocument();
    expect(sheet.getByRole('rowheader', { name: 'Proficiency' })).toBeInTheDocument();
  });

  it('Ignore rules lets a broken pick through, and the sheet warns about it', async () => {
    const user = userEvent.setup();
    renderTab(duo());
    await user.click(
      within(screen.getByRole('region', { name: 'Lorekeeper' })).getByRole('button', {
        name: 'Change prepared',
      }),
    );
    const dialog = within(
      await screen.findByRole('dialog', { name: 'Lorekeeper: prepared spells' }),
    );
    await user.click(await dialog.findByRole('checkbox', { name: 'Ignore rules' }));
    await user.click(dialog.getByRole('checkbox', { name: /Hex Mark/ }));
    await user.click(dialog.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('list', { name: 'Spell warnings' })).toHaveTextContent(
      "Lorekeeper: Hex Mark isn't in your spellbook.",
    );
  });
});
