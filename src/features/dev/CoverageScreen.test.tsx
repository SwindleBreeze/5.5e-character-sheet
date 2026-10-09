import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../db/db.ts';
import { renderApp } from '../../test/renderApp.tsx';
import { seedFixtureContent } from '../../test/seedContent.ts';

beforeEach(async () => {
  await resetDb('test-coverage');
});

describe('CoverageScreen', () => {
  it('summarises the enabled sources and lists features by filter', async () => {
    const user = userEvent.setup();
    await seedFixtureContent(['TST']);
    renderApp('/dev/coverage');

    // The app's mappings are for XPHB features, which the fixture content doesn't have.
    expect(await screen.findByText(/42 features: 0 mapped/)).toBeInTheDocument();
    expect(screen.getByText('Every mapping is valid.')).toBeInTheDocument();
    expect(screen.getByText(/mappings are for content that isn’t imported/)).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Show' }), 'all');
    const list = screen.getByRole('list', { name: 'Features' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(42);
    expect(within(list).getByText('Static Charge')).toBeInTheDocument();
  });
});
