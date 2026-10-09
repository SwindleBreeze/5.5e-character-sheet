import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb } from '../../db/db.ts';
import { repos } from '../../db/repos.ts';
import { seedHomebrew } from '../../test/homebrewFixture.ts';
import { renderApp } from '../../test/renderApp.tsx';
import { seedFixtureContent } from '../../test/seedContent.ts';

beforeEach(async () => {
  await resetDb('test-homebrew-sources');
  await seedFixtureContent(['TST']);
  await seedHomebrew(['TST', 'HearthGuide', 'BrutePaths']);
});

const homebrewGroup = async () => within(await screen.findByRole('group', { name: 'Homebrew' }));

describe('Settings → Sources: homebrew (plan step 7.3)', () => {
  it('has its own group, with who made it, and presets leave it alone', async () => {
    const user = userEvent.setup();
    renderApp('/settings');
    const group = await homebrewGroup();
    // Checked once the saved setting has been read.
    await waitFor(() =>
      expect(group.getByRole('checkbox', { name: /The Hearthkeeper's Guide/ })).toBeChecked(),
    );
    expect(group.getByText('HG')).toBeInTheDocument();
    expect(group.getByText('by Tess Example, Rowan Sample · version 1.2.0')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '2024 core' }));
    await waitFor(async () =>
      expect(await repos().settings.get('enabledSources')).toEqual([
        'BrutePaths',
        'HearthGuide',
        'TST',
      ]),
    );
  });

  it('removes a homebrew source after asking', async () => {
    const user = userEvent.setup();
    renderApp('/settings');
    const group = await homebrewGroup();
    await user.click(group.getByRole('button', { name: "Remove The Hearthkeeper's Guide…" }));
    const sheet = within(
      await screen.findByRole('dialog', { name: "Remove The Hearthkeeper's Guide?" }),
    );
    expect(sheet.getByText(/Characters that use it keep what they have/)).toBeInTheDocument();
    await user.click(sheet.getByRole('button', { name: 'Remove' }));

    await waitFor(async () =>
      expect(await repos().content.get('class', 'hearthwarden|hearthguide')).toBeUndefined(),
    );
    expect((await repos().content.listSources()).map((s) => s.code)).not.toContain('HearthGuide');
    expect((await repos().settings.get('enabledSources')).sort()).toEqual(['BrutePaths', 'TST']);
  });

  it('shares the homebrew as one pack file', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => 'blob:pack');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderApp('/settings');

    await user.click((await homebrewGroup()).getByRole('button', { name: 'Share homebrew' }));
    await vi.waitFor(() => expect(click).toHaveBeenCalled());
    const file = (createObjectURL.mock.calls[0] as unknown as [File])[0];
    expect(file.name).toMatch(/^homebrew-\d{4}-\d{2}-\d{2}\.pack\.json\.gz$/);
    vi.unstubAllGlobals();
  });
});
