import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildBackup, REMINDER_AFTER_MS } from '../../db/backup.ts';
import { createCharacterRepo, newCharacter } from '../../db/characterRepo.ts';
import { resetDb } from '../../db/db.ts';
import { repos } from '../../db/repos.ts';
import { renderApp } from '../../test/renderApp.tsx';

let downloads: File[];

beforeEach(async () => {
  await resetDb('test-backup-card');
  downloads = [];
  vi.stubGlobal(
    'URL',
    Object.assign(URL, {
      createObjectURL: (file: File) => {
        downloads.push(file);
        return 'blob:x';
      },
      revokeObjectURL: () => {},
    }),
  );
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Backup', () => {
  it('backs up characters to a file and records the time', async () => {
    const user = userEvent.setup();
    await createCharacterRepo().save(newCharacter('Ada'));
    renderApp('/settings');

    await user.click(await screen.findByRole('button', { name: 'Back up characters' }));
    expect(await screen.findByText('Backup saved.')).toBeInTheDocument();
    expect(downloads[0]?.name).toMatch(/^characters-.*\.backup\.json$/);
    expect(JSON.parse(await downloads[0]!.text()).characters[0].name).toBe('Ada');
    expect(await repos().settings.get('lastBackupAt')).toEqual(expect.any(Number));
  });

  it('restores from a backup file after confirming', async () => {
    const user = userEvent.setup();
    await createCharacterRepo().save(newCharacter('Brin'));
    const text = JSON.stringify(await buildBackup());
    await resetDb('test-backup-card-2');
    renderApp('/settings');

    await user.upload(await screen.findByLabelText('Restore…'), new File([text], 'b.backup.json'));
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByText(/Brin/)).toBeInTheDocument();
    await user.click(within(sheet).getByRole('button', { name: 'Restore 1' }));

    expect(await screen.findByText('Restored 1 character.')).toBeInTheDocument();
    expect((await repos().characters.list()).map((c) => c.name)).toEqual(['Brin']);
  });

  it('shows a reminder on the characters screen when a backup is overdue', async () => {
    const user = userEvent.setup();
    const old = Date.now() - REMINDER_AFTER_MS - 1000;
    await createCharacterRepo().save(newCharacter('Ada', old), old);
    renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Time for a backup' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back up now' }));
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Time for a backup' })).toBeNull(),
    );
  });
});
