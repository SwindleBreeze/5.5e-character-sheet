import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb } from '../../db/db.ts';
import { repos } from '../../db/repos.ts';
import { homebrewFiles, homebrewUploads } from '../../test/homebrewFixture.ts';
import { renderApp } from '../../test/renderApp.tsx';
import { seedFixtureContent } from '../../test/seedContent.ts';

beforeEach(async () => {
  await resetDb('test-import-homebrew-page');
  await seedFixtureContent(['TST']);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ImportPage: homebrew (plan step 7.3)', () => {
  it('imports homebrew files and lists what was skipped and why', async () => {
    const user = userEvent.setup();
    renderApp('/library/import');

    await user.upload(await screen.findByLabelText('Open homebrew files'), homebrewUploads());

    const result = await screen.findByRole('region', { name: 'Import finished' });
    expect(within(result).getByText(/Homebrew imported/)).toHaveTextContent('2 sources');
    expect(within(result).getByText('Classes').nextSibling).toHaveTextContent('1');
    await user.click(within(result).getByText(/warnings/));
    expect(
      within(result).getByRole('heading', { name: /Skipped: source already imported \(1\)/ }),
    ).toBeInTheDocument();
    expect(within(result).getByText(/needs KettleCompendium/)).toBeInTheDocument();
    expect(await repos().content.get('class', 'hearthwarden|hearthguide')).toBeDefined();
  });

  it('downloads a homebrew link', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(homebrewFiles('brute-paths.json')[0]!.text)),
    );
    renderApp('/library/import');

    await user.type(
      await screen.findByRole('textbox', { name: 'Link to a homebrew file' }),
      'https://example.com/brute-paths.json',
    );
    await user.click(screen.getByRole('button', { name: 'Download' }));
    const result = await screen.findByRole('region', { name: 'Import finished' });
    expect(within(result).getByText(/Homebrew imported/)).toHaveTextContent('1 source');
    expect(await repos().content.get('subclass', 'kettle|brute|tst|brutepaths')).toBeDefined();
  });
});
