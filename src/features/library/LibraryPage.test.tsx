import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb, type AppDb } from '../../db/db.ts';
import { repos } from '../../db/repos.ts';
import { renderApp } from '../../test/renderApp.tsx';
import { seedFixtureContent } from '../../test/seedContent.ts';
import { filterLibrary, searchKey } from './libraryFilter.ts';

let db: AppDb;

beforeEach(async () => {
  db = await resetDb('test-library');
});

const results = () => screen.findByRole('list', { name: 'Results' });
const names = async () =>
  within(await results())
    .getAllByRole('button')
    .map((b) => b.querySelector('span span')?.textContent);

describe('LibraryPage', () => {
  it('points to the importer when nothing is imported', async () => {
    renderApp('/library');
    expect(await screen.findByRole('link', { name: 'Import your group’s pack' })).toHaveAttribute(
      'href',
      '/library/import',
    );
  });

  it('lists available spells; 2014 and reprinted content stay hidden', async () => {
    await seedFixtureContent();
    renderApp('/library');
    await waitFor(async () =>
      expect(await names()).toEqual([
        'Dim Lantern',
        'Glitter Burst',
        'Hex Mark',
        'Ink Cloud',
        'Mind Ward',
        'Rolling Boom',
        'Spark Bolt',
      ]),
    );
    expect(screen.getByText(/1 hidden by source settings/)).toBeInTheDocument();
  });

  it('switches kind, searches and filters through the URL', async () => {
    const user = userEvent.setup();
    await seedFixtureContent();
    renderApp('/library');

    await user.click(await screen.findByRole('tab', { name: 'Items' }));
    // The list is virtual: count the results, not the rows drawn.
    expect(await screen.findByText(/^23 results/)).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'torch');
    await waitFor(async () => expect(await names()).toEqual(['Everburning Torch', 'Torch']));

    await user.clear(screen.getByRole('searchbox', { name: 'Search' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'weapon');
    await waitFor(async () =>
      expect(await names()).toEqual(['Arc Bow', 'Net Blade', 'Shiv', 'Walking Staff', 'Wrist Bow']),
    );
  });

  it('opens an entry in the rule sheet', async () => {
    const user = userEvent.setup();
    await seedFixtureContent();
    renderApp('/library?kind=feat');

    await user.click(await screen.findByRole('button', { name: /Arena Veteran/ }));
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByText('Level 4+, Strength 13+ or Charisma 13+')).toBeInTheDocument();
  });

  it('lists deities from the enabled sources', async () => {
    const user = userEvent.setup();
    await seedFixtureContent(['TST']);
    renderApp('/library?kind=deity');

    // The three Old Almanac (2014) printings are hidden like any other 2014 content.
    await waitFor(async () => expect(await names()).toEqual(['Brask', 'Mirela']));
    expect(screen.getByText(/3 hidden by source settings/)).toBeInTheDocument();
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Pantheon' }), 'Seafolk');
    await waitFor(async () => expect(await names()).toEqual(['Brask']));

    // 2014-only kinds get no tab until phase 8.
    expect(screen.queryByRole('tab', { name: 'Creation options' })).toBeNull();
  });

  it('asks for a new import when an older app skipped a kind the sources list', async () => {
    await seedFixtureContent(['TST']);
    await db.deities.clear();
    renderApp('/library?kind=deity');
    expect(await screen.findByText(/imported by an older version of the app/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Import the pack again' })).toHaveAttribute(
      'href',
      '/library/import',
    );
  });

  it('lists gifts and Bastion facilities', async () => {
    const user = userEvent.setup();
    await seedFixtureContent(['TST']);
    renderApp('/library?kind=reward');

    await waitFor(async () =>
      expect(await names()).toEqual([
        'Blessing of the Crowd',
        'Charm of Embers',
        'Charm of Sparks',
      ]),
    );

    await user.click(screen.getByRole('tab', { name: 'Bastion' }));
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Type' }), 'special');
    await waitFor(async () => expect(await names()).toEqual(['Guild Hall', 'Spark Forge']));
    await user.click(screen.getByRole('button', { name: /Spark Forge/ }));
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByText('1 (roomy), 2 (vast)')).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Charm' })).toBeInTheDocument();
  });

  it('toggles sources from the header', async () => {
    const user = userEvent.setup();
    await seedFixtureContent(['TST']);
    renderApp('/library');

    await user.click(await screen.findByRole('button', { name: 'Sources (1)' }));
    const sheet = await screen.findByRole('dialog');
    await user.click(within(sheet).getByRole('checkbox', { name: /Test Handbook/ }));
    await waitFor(async () => expect(await repos().settings.get('enabledSources')).toEqual([]));
    expect(within(sheet).getByRole('checkbox', { name: /Old Almanac/ })).toBeDisabled();
    expect(await screen.findByText('All sources are switched off.')).toBeInTheDocument();
  });

  it('shows 2014 content once "Show 2014 content" is on (step 8.1)', async () => {
    const user = userEvent.setup();
    await seedFixtureContent(['TST']);
    renderApp('/settings');

    await user.click(await screen.findByRole('checkbox', { name: /Show 2014 content/ }));
    const old = await screen.findByRole('checkbox', { name: /Old Almanac/ });
    await waitFor(() => expect(old).toBeEnabled());
    await user.click(old);
    await waitFor(async () =>
      expect(await repos().settings.get('enabledSources')).toEqual(['OLD', 'TST']),
    );

    // The Old Almanac's deities are offered now; off again, they are hidden, and the book stays
    // switched on for when 2014 content comes back.
    renderApp('/library?kind=deity');
    await waitFor(async () => expect((await names()).length).toBeGreaterThan(2));
    await repos().settings.set('show2014', false);
    await waitFor(async () => expect(await names()).toEqual(['Brask', 'Mirela']));
    expect(await repos().settings.get('enabledSources')).toEqual(['OLD', 'TST']);
  });
});

describe('libraryFilter', () => {
  it('search ignores case and accents', () => {
    expect(searchKey('Brávado’s')).toBe("bravado's");
  });

  it('sorts by name then source', () => {
    const list = [
      { name: 'B', source: 'X' },
      { name: 'A', source: 'Z' },
      { name: 'A', source: 'Y' },
    ] as never[];
    expect(filterLibrary(list, '', {}, 'spell').map((e: { source: string }) => e.source)).toEqual([
      'Y',
      'Z',
      'X',
    ]);
  });
});
