import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { importFivetools } from '../../adapters/fivetools/index.ts';
import { buildPack, encodePack } from '../../adapters/pack/packFile.ts';
import { resetDb } from '../../db/db.ts';
import { repos } from '../../db/repos.ts';
import { fixtureSource } from '../../test/fivetoolsFixture.ts';
import { renderApp } from '../../test/renderApp.tsx';
import { seedFixtureContent } from '../../test/seedContent.ts';

beforeEach(async () => {
  await resetDb('test-import-page');
});

async function fixturePackFile(): Promise<File> {
  const r = await importFivetools(fixtureSource(), { now: 1 });
  const bytes = await encodePack(buildPack(r.entities, r.sources, 1, 1));
  return new File([new Uint8Array(bytes)], 'group.pack.json.gz', { type: 'application/gzip' });
}

describe('ImportPage', () => {
  it('imports a pack file and shows what it added', async () => {
    const user = userEvent.setup();
    renderApp('/library/import');

    await user.upload(await screen.findByLabelText('Open pack file'), await fixturePackFile());

    const result = await screen.findByRole('region', { name: 'Import finished' });
    expect(within(result).getByText(/Pack imported/)).toBeInTheDocument();
    expect(within(result).getByText('Spells').nextSibling).toHaveTextContent('8');
    expect(await repos().content.countByKind('class')).toBe(5);
  });

  it('explains a file that is not a pack', async () => {
    const user = userEvent.setup();
    renderApp('/library/import');
    await user.upload(
      await screen.findByLabelText('Open pack file'),
      new File(['hello'], 'x.json'),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('not a content pack');
  });

  it('imports a 5etools zip', async () => {
    const user = userEvent.setup();
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    const { fixtureFiles } = await import('../../test/fivetoolsFixture.ts');
    for (const [path, text] of Object.entries(fixtureFiles('5etools/data/'))) zip.file(path, text);
    const file = new File(
      [new Uint8Array(await zip.generateAsync({ type: 'uint8array' }))],
      '5etools.zip',
    );
    renderApp('/library/import');

    await user.upload(await screen.findByLabelText('Choose zip'), file);
    const result = await screen.findByRole('region', { name: 'Import finished' });
    expect(within(result).getByText(/5etools data imported/)).toBeInTheDocument();
  });

  it('exports a pack of the imported content', async () => {
    const user = userEvent.setup();
    await seedFixtureContent();
    const createObjectURL = vi.fn(() => 'blob:pack');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderApp('/library/import');

    await user.click(await screen.findByRole('button', { name: 'Export pack' }));
    await vi.waitFor(() => expect(click).toHaveBeenCalled());
    const file = (createObjectURL.mock.calls[0] as unknown as [File])[0];
    expect(file.name).toMatch(/^content-\d{4}-\d{2}-\d{2}\.pack\.json\.gz$/);
    vi.unstubAllGlobals();
  });
});
