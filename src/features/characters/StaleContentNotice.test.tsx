import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { importFivetools } from '../../adapters/fivetools/index.ts';
import { resetDb } from '../../db/db.ts';
import { repos } from '../../db/repos.ts';
import { fixtureSource } from '../../test/fivetoolsFixture.ts';
import { renderApp } from '../../test/renderApp.tsx';

beforeEach(async () => {
  await resetDb('test-stale-content');
});

async function seed(adapterVersion?: number) {
  const result = await importFivetools(fixtureSource(), { now: 1 });
  const sources = result.sources.map((s) =>
    adapterVersion === undefined ? s : { ...s, adapterVersion },
  );
  await repos().content.replaceSources(sources, result.entities);
}

describe('content imported by an older version (plan step 7.1)', () => {
  it('asks for a re-import and says what it adds', async () => {
    await seed(5);
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Re-import your content' })).toBeTruthy();
    expect(screen.getByText(/spells that magic items cast/)).toBeTruthy();
  });

  it('says nothing when the content is current', async () => {
    await seed();
    renderApp('/');
    await screen.findByRole('heading', { name: 'Characters' });
    expect(screen.queryByRole('heading', { name: 'Re-import your content' })).toBeNull();
  });
});
