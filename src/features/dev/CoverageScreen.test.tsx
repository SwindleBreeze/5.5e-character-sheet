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

    // The app registry has no mappings yet, so nothing is mapped and nothing is broken.
    expect(await screen.findByText(/41 features: 0 mapped/)).toBeInTheDocument();
    expect(screen.getByText('Every mapping is valid.')).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Show' }), 'all');
    const list = screen.getByRole('list', { name: 'Features' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(41);
    expect(within(list).getByText('Static Charge')).toBeInTheDocument();
  });
});
