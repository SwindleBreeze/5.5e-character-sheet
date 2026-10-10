import { cleanup, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../db/db.ts';
import { repos } from '../../db/repos.ts';
import type { Character } from '../../schema/index.ts';
import { renderApp } from '../../test/renderApp.tsx';
import { seedFixtureContent } from '../../test/seedContent.ts';

beforeEach(async () => {
  await resetDb('test-wizard');
  await seedFixtureContent(['TST']);
});

const next = (name: RegExp) => screen.getByRole('button', { name });
const region = (name: string | RegExp) => within(screen.getByRole('region', { name }));
/** The chosen card in a list: it opens with its choices inside. */
const card = (name: string) => within(screen.getByRole('listitem', { name }));
const footer = () => within(screen.getByRole('navigation', { name: 'Wizard' }));

/** The draft as saved (saves are coalesced: wait for the one expected). */
async function stored(check: (c: Character) => boolean): Promise<Character> {
  let found: Character | undefined;
  await waitFor(async () => {
    found = (await repos().characters.list()).find(check);
    expect(found).toBeDefined();
  });
  return found!;
}

type User = ReturnType<typeof userEvent.setup>;

const optionA = (where: ReturnType<typeof within>) =>
  within(where.getByRole('region', { name: 'Starting equipment' })).getByRole('radio', {
    name: /Option A/,
  });

/** A Brute with its skills and equipment chosen. */
async function brute(user: User) {
  await user.click(await screen.findByRole('radio', { name: 'Brute' }));
  await user.click(card('Brute').getByRole('checkbox', { name: 'Intimidation' }));
  await user.click(card('Brute').getByRole('checkbox', { name: 'Survival' }));
  await user.click(optionA(card('Brute')));
}

/** Arena Hand with everything it asks for. */
async function arenaHand(user: User) {
  await user.click(await screen.findByRole('radio', { name: 'Arena Hand' }));
  const arena = card('Arena Hand');
  await user.click(arena.getByRole('radio', { name: '+2 Strength, +1 Constitution' }));
  const [languages] = arena.getAllByRole('region', { name: 'Languages' });
  await user.click(within(languages!).getByRole('checkbox', { name: 'Arenic' }));
  const feat = within(arena.getByRole('region', { name: 'Spark Initiate; Gladiator' }));
  await user.click(feat.getByRole('radio', { name: /Intelligence/ }));
  await user.click(feat.getByRole('checkbox', { name: 'Glitter Burst' }));
  await user.click(optionA(arena));
}

/** A Mossling of the Deep Lineage, Small. */
async function deepMossling(user: User) {
  await user.selectOptions(await screen.findByRole('combobox', { name: 'Species' }), 'Mossling');
  await user.selectOptions(screen.getByRole('combobox', { name: 'Lineage' }), 'Deep Lineage');
  await user.click(region('Mossling; Deep Lineage choices').getByRole('radio', { name: 'Small' }));
}

describe('creation wizard', () => {
  it('creates a level 1 character: class → background → species → … → review → sheet', async () => {
    const user = userEvent.setup();
    renderApp('/new/draft/class');

    await user.click(await screen.findByRole('radio', { name: 'Brute' }));
    // The chosen class opens in place: its skills and equipment are chosen right there.
    const brute = card('Brute');
    expect(brute.getByText(/lifting the other side over their heads/)).toBeInTheDocument();
    // Next stays closed until the class's picks are made, and says what is left.
    expect(next(/Background ›/)).toHaveAttribute('aria-disabled', 'true');
    expect(footer().getByText(/Brute: Skills \(2 more\)/)).toBeInTheDocument();
    await user.click(next(/Background ›/));
    expect(screen.getByRole('heading', { level: 2, name: 'Class' })).toBeInTheDocument();
    await user.click(brute.getByRole('checkbox', { name: 'Intimidation' }));
    await user.click(brute.getByRole('checkbox', { name: 'Survival' }));
    await user.click(
      within(brute.getByRole('region', { name: 'Starting equipment' })).getByRole('radio', {
        name: /Option A/,
      }),
    );
    expect(next(/Background ›/)).toHaveAttribute('aria-disabled', 'false');
    await user.click(next(/Background ›/));

    await user.click(await screen.findByRole('radio', { name: 'Arena Hand' }));
    const arena = card('Arena Hand');
    await user.click(arena.getByRole('radio', { name: '+2 Strength, +1 Constitution' }));
    // The tile shows the increases picked.
    expect(arena.getByText('+2 STR, +1 CON')).toBeInTheDocument();
    // Languages, the Origin feat's picks and equipment, all in the card.
    const [languages] = arena.getAllByRole('region', { name: 'Languages' });
    await user.click(within(languages!).getByRole('checkbox', { name: 'Arenic' }));
    const feat = within(arena.getByRole('region', { name: 'Spark Initiate; Gladiator' }));
    await user.click(feat.getByRole('radio', { name: /Intelligence/ }));
    await user.click(feat.getByRole('checkbox', { name: 'Glitter Burst' }));
    await user.click(
      within(arena.getByRole('region', { name: 'Starting equipment' })).getByRole('radio', {
        name: /Option A/,
      }),
    );
    await user.click(next(/Species ›/));

    // One menu for the species, a second for its versions.
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Species' }), 'Mossling');
    expect(footer().getByText(/Choose a lineage/)).toBeInTheDocument();
    expect(next(/Ability scores ›/)).toHaveAttribute('aria-disabled', 'true');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Lineage' }), 'Deep Lineage');
    const deep = region('Mossling; Deep Lineage choices');
    await user.click(deep.getByRole('radio', { name: 'Small' }));
    await user.click(next(/Ability scores ›/));

    // The standard array, Strength first for a Brute; the background's +2 shown applied.
    const scores = within(await screen.findByRole('table', { name: 'Ability scores' }));
    const strength = within(scores.getByRole('row', { name: /Strength/ }));
    expect(strength.getByRole('combobox', { name: 'Strength score' })).toHaveValue('15');
    expect(strength.getByText('17')).toBeInTheDocument();
    // Brute has nothing more to choose at level 1, and no spells: no "Class features" or
    // "Spells" step.
    await user.click(next(/Details ›/));

    const name = await screen.findByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Tess');
    await user.click(next(/Review ›/));

    expect(await screen.findByRole('heading', { name: 'Tess' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Still to choose' })).not.toBeInTheDocument();
    const items = within(screen.getByRole('list', { name: 'Starting items' }));
    expect(items.getByText(/Net Blade/)).toHaveTextContent('Net Blade (in hand)');
    await user.click(screen.getByRole('button', { name: 'Create character' }));

    // The sheet opens.
    expect(await screen.findByRole('tab', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Tess' })).toBeInTheDocument();
    const c = await stored((x) => x.name === 'Tess' && !x.draft);
    expect(c.log).toHaveLength(1);
    expect(c.log[0]).toMatchObject({
      classRef: { id: 'brute|tst' },
      hp: { mode: 'max' },
      origin: {
        speciesRef: { id: 'mossling; deep lineage|tst' },
        backgroundRef: { id: 'arena hand|tst' },
      },
    });
    expect(c.log[0]?.choices.every((r) => r.via === 'creation')).toBe(true);
    expect(
      c.log[0]?.choices.find((r) => r.key.slot === 'skills' && r.key.owner.id === 'brute|tst')
        ?.values,
    ).toEqual(['intimidation', 'survival']);
    expect(c.baseScores.str).toBe(15);
    expect(c.inventory.map((r) => r.name)).toEqual(['Net Blade', 'Shiv', 'Torch']);
    expect(c.snapshots['class:brute|tst']).toBeDefined();
  });

  it('introduces each step and explains what the class, background and species give (plan §9.3b)', async () => {
    const user = userEvent.setup();
    renderApp('/new/draft/class');
    // Where the step sits in the rules, and what it decides.
    expect(await screen.findByText('Step 1 of 5 · Choose a class')).toBeInTheDocument();
    expect(screen.getByText(/Your class is what your character does best/)).toBeInTheDocument();

    await brute(user);
    const bruteCard = card('Brute');
    // Flavor text from the imported content, then what the class gives, folded.
    expect(bruteCard.getByText(/lifting the other side over their heads/)).toBeInTheDocument();
    const gives = within(bruteCard.getByRole('group', { name: 'Everything the Brute gives' }));
    expect(gives.getByText(/12 \+ your Constitution modifier at level 1/)).toBeInTheDocument();
    // A line on what each pick is for, next to it.
    expect(
      within(bruteCard.getByRole('region', { name: 'Skills' })).getByText(/proficiency bonus/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /Background/ }));
    expect(await screen.findByText('Step 2 of 5 · Origin: background')).toBeInTheDocument();
    // Each background shows its numbers before it is chosen.
    const option = screen.getByRole('radio', { name: 'Arena Hand' });
    expect(option).toHaveAccessibleDescription(/\+2\/\+1 or \+1 each: STR · CON · CHA/);
    await arenaHand(user);
    const arena = card('Arena Hand');
    expect(arena.getByText('You swept the sand between bouts.')).toBeInTheDocument();
    expect(arena.getByText('Athletics and Performance')).toBeInTheDocument();
    expect(arena.getByText('Origin feat: Spark Initiate; Gladiator')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /Species/ }));
    await deepMossling(user);
    const deep = region('Mossling; Deep Lineage choices');
    expect(deep.getByText('What the Mossling; Deep Lineage adds')).toBeInTheDocument();
    expect(deep.getByText('120 ft.')).toBeInTheDocument();
    // A lineage without flavor text of its own shows its species'.
    expect(deep.getByText(/coat of soft moss/)).toBeInTheDocument();
    // What every Mossling has: shown, not folded away.
    expect(deep.getByRole('region', { name: 'What every Mossling has' })).toBeVisible();
  });

  it('a draft is saved as it goes and continued from the characters list', async () => {
    const user = userEvent.setup();
    renderApp('/new/draft/class');
    await brute(user);
    await user.click(screen.getByRole('link', { name: /Background/ }));
    await screen.findByRole('radio', { name: 'Arena Hand' });
    await stored((c) => c.draft?.step === 'background' && c.log.length === 1);
    cleanup();

    // Later: the list offers to continue, on the step it was left at.
    renderApp('/');
    await user.click(await screen.findByRole('link', { name: 'Continue creating New character' }));
    expect(await screen.findByRole('radio', { name: 'Arena Hand' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '2. Background' })).toHaveAttribute(
      'aria-current',
      'step',
    );
    await user.click(screen.getByRole('link', { name: '1. Class' }));
    expect(await screen.findByRole('radio', { name: 'Brute' })).toBeChecked();
  });

  it('a pick taken back can be picked again', async () => {
    const user = userEvent.setup();
    renderApp('/new/draft/class');
    await user.click(await screen.findByRole('radio', { name: 'Brute' }));
    const brute = card('Brute');
    const intimidation = () => brute.getByRole('checkbox', { name: 'Intimidation' });
    await user.click(intimidation());
    await waitFor(() => expect(intimidation()).toBeChecked());
    await user.click(intimidation());
    await waitFor(() => expect(intimidation()).not.toBeChecked());
    expect(brute.queryByText('You have it already')).toBeNull();
    expect(intimidation()).toBeEnabled();
    await user.click(intimidation());
    await waitFor(() => expect(intimidation()).toBeChecked());
  });

  it('steps after one with picks left stay closed', async () => {
    const user = userEvent.setup();
    renderApp('/new/draft/class');
    await user.click(await screen.findByRole('radio', { name: 'Brute' }));
    expect(screen.queryByRole('link', { name: /Background/ })).not.toBeInTheDocument();
    expect(screen.getByText('2. Background')).toHaveAttribute('aria-disabled', 'true');
    expect(next(/Background ›/)).toHaveAttribute('aria-disabled', 'true');
    expect(footer().getByText(/Brute: starting equipment/)).toBeInTheDocument();
    await user.click(next(/Background ›/));
    expect(screen.getByRole('heading', { level: 2, name: 'Class' })).toBeInTheDocument();

    await brute(user);
    expect(screen.getByRole('link', { name: '2. Background' })).toBeInTheDocument();
    // Only up to the next step with picks left.
    expect(screen.getByText('3. Species')).toHaveAttribute('aria-disabled', 'true');
  });

  it('changing the class sets its picks aside; switching back brings them back', async () => {
    const user = userEvent.setup();
    renderApp('/new/draft/class');
    await brute(user);
    await user.click(screen.getByRole('link', { name: /Background/ }));
    await user.click(await screen.findByRole('radio', { name: 'Arena Hand' }));
    await user.click(await screen.findByRole('radio', { name: '+2 Strength, +1 Constitution' }));
    await user.click(screen.getByRole('link', { name: '1. Class' }));

    // No dialog: the Brute's picks go aside.
    await user.click(await screen.findByRole('radio', { name: 'Lorekeeper' }));
    expect(await screen.findByRole('listitem', { name: 'Lorekeeper' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    let c = await stored((x) => x.log[0]?.classRef.id === 'lorekeeper|tst');
    expect(c.log[0]?.choices.map((r) => `${r.key.owner.id}#${r.key.slot}`)).toEqual([
      'arena hand|tst#ability',
    ]);

    // Back to the Brute: its skills and equipment are as they were.
    await user.click(screen.getByRole('radio', { name: 'Brute' }));
    const bruteCard = card('Brute');
    expect(await bruteCard.findByRole('checkbox', { name: 'Intimidation' })).toBeChecked();
    expect(bruteCard.getByRole('checkbox', { name: 'Survival' })).toBeChecked();
    expect(optionA(bruteCard)).toBeChecked();
    c = await stored((x) => x.log[0]?.classRef.id === 'brute|tst');
    expect(c.draft?.setAside).toEqual([]);
  });

  it('ability scores: point buy with − and +, kept to 27 points; each roll its own tile', async () => {
    const user = userEvent.setup();
    renderApp('/new/draft/class');
    await brute(user);
    await user.click(next(/Background ›/));
    await arenaHand(user);
    await user.click(next(/Species ›/));
    await deepMossling(user);
    await user.click(screen.getByRole('link', { name: /Ability scores/ }));
    await user.click(await screen.findByRole('button', { name: 'Point buy' }));
    expect(await screen.findByText(/points left/)).toHaveTextContent('27 of 27 points left');
    const up = screen.getByRole('button', { name: 'Increase Strength score' });
    for (let i = 0; i < 7; i++) await user.click(up);
    expect(screen.getByRole('group', { name: 'Strength score' })).toHaveTextContent('15');
    expect(screen.getByText(/points left/)).toHaveTextContent('18 of 27 points left');
    // 15 is the most point buy allows.
    expect(up).toHaveAttribute('aria-disabled', 'true');
    await user.click(screen.getByRole('button', { name: 'Decrease Strength score' }));
    expect(screen.getByText(/points left/)).toHaveTextContent('20 of 27 points left');

    await user.click(screen.getByRole('button', { name: 'Roll' }));
    const rolls = within(await screen.findByRole('list', { name: 'Rolled scores' }));
    const tiles = rolls.getAllByRole('listitem');
    expect(tiles).toHaveLength(6);
    // Each tile: its total, the dice, and the ability it went to (the highest to Strength).
    const highest = Math.max(
      ...tiles.map((t) => Number(/\d+/.exec(t.getAttribute('aria-label')!)![0])),
    );
    expect(rolls.getAllByRole('listitem', { name: `Total ${highest}` })[0]).toHaveTextContent(
      'Strength',
    );
  });

  it('starting above level 1: each level made for you, changed on its card (plan step 5.4)', async () => {
    const user = userEvent.setup();
    renderApp('/new/draft/class');
    await brute(user);
    await user.click(screen.getByRole('button', { name: 'Raise starting level' }));
    await user.click(screen.getByRole('button', { name: 'Raise starting level' }));
    expect(screen.getByRole('group', { name: 'Starting level' })).toHaveTextContent('3');
    expect(screen.getByText(/Higher levels/)).toBeInTheDocument();
    await user.click(next(/Background ›/));
    await arenaHand(user);
    await user.click(next(/Species ›/));
    await deepMossling(user);
    await user.click(next(/Ability scores ›/));
    await user.click(next(/Spells ›|Higher levels ›/));
    while (!screen.queryByRole('list', { name: 'Levels' })) await user.click(next(/›/));

    const levels = within(screen.getByRole('list', { name: 'Levels' }));
    const three = within(levels.getByRole('listitem', { name: 'Level 3' }));
    // The subclass comes at Brute 3, picked for you.
    expect(three.getByRole('combobox', { name: 'Brute Path' })).toHaveValue('spark|brute|tst|tst');
    // Level 2 as a Lorekeeper instead: a multiclass, with its requirement.
    const two = within(levels.getByRole('listitem', { name: 'Level 2' }));
    await user.selectOptions(two.getByRole('combobox', { name: 'Class' }), 'lorekeeper|tst');
    expect(
      within(screen.getByRole('listitem', { name: 'Level 2' })).getByText(
        /Lorekeeper: Intelligence 13\+/,
      ),
    ).toBeInTheDocument();
    const c = await stored((x) => x.log[1]?.classRef.id === 'lorekeeper|tst');
    expect(c.log.map((e) => `${e.classRef.id} ${e.classLevel}`)).toEqual([
      'brute|tst 1',
      'lorekeeper|tst 1',
      'brute|tst 2',
    ]);
  });
});

describe('2014 options (step 8.2)', () => {
  beforeEach(async () => {
    await seedFixtureContent(['TST', 'OLD']);
    await repos().settings.set('show2014', true);
  });

  it('a 2014 background: free ability increases on a grid, and an Origin feat', async () => {
    const user = userEvent.setup();
    renderApp('/new/draft/class');
    await brute(user);
    await user.click(next(/Background ›/));

    await user.click(await screen.findByRole('radio', { name: 'Old Sailor' }));
    const sailor = card('Old Sailor');
    expect(sailor.getByText(/A 2014 background/)).toBeInTheDocument();
    // One row per ability with +2 and +1, not every combination.
    const grid = within(sailor.getByRole('list', { name: 'Ability increases' }));
    expect(grid.getAllByRole('listitem')).toHaveLength(6);
    await user.click(grid.getByRole('button', { name: '+2 Wisdom' }));
    await user.click(grid.getByRole('button', { name: '+1 Charisma' }));
    expect(grid.getByRole('button', { name: '+2 Wisdom' })).toHaveAttribute('aria-pressed', 'true');
    await stored((c) =>
      c.log[0]!.choices.some((r) => r.key.slot === 'ability' && r.values.join() === 'wis,wis,cha'),
    );
    // Its Origin feat: Origin feats only.
    expect(sailor.getAllByRole('radio', { name: /Spark Initiate/ }).length).toBeGreaterThan(0);
    expect(sailor.queryByRole('radio', { name: /Arena Veteran/ })).toBeNull();
  });

  it('a 2014 species: the background gives the increases, unless the species keeps its own', async () => {
    const user = userEvent.setup();
    renderApp('/new/draft/class');
    await brute(user);
    await user.click(next(/Background ›/));
    await arenaHand(user);
    await user.click(next(/Species ›/));

    await user.selectOptions(await screen.findByRole('combobox', { name: 'Species' }), 'Cragling');
    const cragling = region('Cragling choices');
    expect(cragling.getByText(/A 2014 species/)).toBeInTheDocument();
    await user.click(cragling.getByRole('checkbox', { name: /own ability increases/ }));
    await stored((c) => c.legacyAbilities === true);
    // The background's increases are set aside; the species' choice of sets is asked for.
    await waitFor(() => expect(footer().getByText(/Cragling/)).toBeInTheDocument());
  });
});
