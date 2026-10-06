import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../db/db.ts';
import type { Entry } from '../schema/index.ts';
import { seedFixtureContent } from '../test/seedContent.ts';
import { SheetProvider } from '../ui/BottomSheet.tsx';
import { Entries } from './Entries.tsx';

const SAMPLE: Entry[] = [
  'Deal {@damage 2d6} damage, as {@b bold {@i nested}} text.',
  {
    type: 'entries',
    name: 'Section',
    entries: [
      { type: 'list', items: ['one', { type: 'item', name: 'Two.', entries: ['second'] }] },
      { type: 'table', caption: 'Roll', colLabels: ['d4', 'Result'], rows: [['1', 'Low']] },
      { type: 'inset', name: 'Sidebar', entries: ['aside'] },
      { type: 'quote', entries: ['Hello.'], by: 'Someone' },
      { type: 'unknown', raw: {} },
    ],
  },
];

function renderEntries(entries: Entry[]) {
  return render(
    <SheetProvider>
      <Entries entries={entries} />
    </SheetProvider>,
  );
}

beforeEach(async () => {
  await resetDb('test-entries');
});

describe('Entries', () => {
  it('renders the entry union', () => {
    const { container } = renderEntries(SAMPLE);
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('renders referenced features inline, and says when one is missing', async () => {
    await seedFixtureContent();
    renderEntries([
      { type: 'ref', ref: { kind: 'subclassFeature', id: 'tangle|gladiator|tst|net|tst|3|tst' } },
      { type: 'ref', ref: { kind: 'classFeature', id: 'gone|gladiator|tst|1|tst' } },
    ]);
    expect(await screen.findByRole('heading', { name: 'Tangle' })).toBeInTheDocument();
    expect(screen.getByText('Your net tangles foes.')).toBeInTheDocument();
    expect(await screen.findByText('(not imported)')).toBeInTheDocument();
  });

  it('opens linked rules in the sheet, and follows links inside it with Back', async () => {
    const user = userEvent.setup();
    await seedFixtureContent();
    renderEntries(['Use a {@item Net Blade|TST} and see {@spell Missing Spell|TST}.']);

    await user.click(screen.getByRole('button', { name: 'Net Blade' }));
    const sheet = await screen.findByRole('dialog');
    expect(await within(sheet).findByText('1d8 slashing (versatile 1d10)')).toBeInTheDocument();

    await user.click(within(sheet).getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Missing Spell' }));
    expect(await screen.findByText(/isn’t in your imported content/)).toBeInTheDocument();
  });

  it('pushes a page when a link inside the sheet is tapped', async () => {
    const user = userEvent.setup();
    await seedFixtureContent();
    renderEntries(['{@race Mossling|TST}']);

    await user.click(screen.getByRole('button', { name: 'Mossling' }));
    const sheet = await screen.findByRole('dialog');
    await user.click(await within(sheet).findByRole('button', { name: 'spores' }));
    expect(await within(sheet).findByText('Sparkles deal', { exact: false })).toBeInTheDocument();

    await user.click(within(sheet).getByRole('button', { name: /Back/ }));
    // Both the sheet title and the entity heading name it.
    await waitFor(() =>
      expect(within(sheet).getAllByRole('heading', { name: 'Mossling' })).toHaveLength(2),
    );
  });
});
