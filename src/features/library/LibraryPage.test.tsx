import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../db/db.ts';
import { repos } from '../../db/repos.ts';
import { renderApp } from '../../test/renderApp.tsx';
import { seedFixtureContent } from '../../test/seedContent.ts';
import { filterLibrary, searchKey } from './libraryFilter.ts';

beforeEach(async () => {
  await resetDb('test-library');
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
    await waitFor(async () => expect(await names()).toEqual(['Dim Lantern', 'Glitter Burst']));
    expect(screen.getByText(/1 hidden by source settings/)).toBeInTheDocument();
  });

  it('switches kind, searches and filters through the URL', async () => {
    const user = userEvent.setup();
    await seedFixtureContent();
    renderApp('/library');

    await user.click(await screen.findByRole('tab', { name: 'Items' }));
    await waitFor(async () => expect(await names()).toHaveLength(7));

    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'torch');
    await waitFor(async () => expect(await names()).toEqual(['Everburning Torch', 'Torch']));

    await user.clear(screen.getByRole('searchbox', { name: 'Search' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'weapon');
    await waitFor(async () => expect(await names()).toEqual(['Net Blade']));
  });

  it('opens an entry in the rule sheet', async () => {
    const user = userEvent.setup();
    await seedFixtureContent();
    renderApp('/library?kind=feat');

    await user.click(await screen.findByRole('button', { name: /Arena Veteran/ }));
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByText('Level 4+, Strength 13+ or Charisma 13+')).toBeInTheDocument();
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
