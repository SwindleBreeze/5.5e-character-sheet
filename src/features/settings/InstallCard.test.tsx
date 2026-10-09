import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { listenForInstall, resetInstallState } from '../../app/install.ts';
import { resetDb } from '../../db/db.ts';
import { repos } from '../../db/repos.ts';
import { renderApp } from '../../test/renderApp.tsx';

beforeAll(() => listenForInstall(window));
beforeEach(async () => {
  await resetDb('test-install');
  resetInstallState();
});

/** The browser saying the app can be installed (Android, desktop Chromium). */
function offerInstall(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: vi.fn(async () => {}),
    userChoice: Promise.resolve({ outcome }),
  });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

describe('install prompt (plan step 7.2)', () => {
  it('offers the browser’s install prompt, saying why', async () => {
    const user = userEvent.setup();
    renderApp('/');
    await screen.findByRole('heading', { name: 'Characters' });
    expect(screen.queryByRole('heading', { name: 'Install the app' })).toBeNull();
    const event = offerInstall();
    expect(await screen.findByRole('heading', { name: 'Install the app' })).toBeTruthy();
    expect(screen.getByText(/keeps its data better/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Install' }));
    expect(event.prompt).toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Install the app' })).toBeNull(),
    );
  });

  it('put away on the Characters screen, it stays in Settings', async () => {
    const user = userEvent.setup();
    offerInstall();
    renderApp('/');
    await user.click(await screen.findByRole('button', { name: 'Not now' }));
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Install the app' })).toBeNull(),
    );
    expect(await repos().settings.get('installCardDismissed')).toBe(true);
  });

  it('Settings shows it even after it was put away', async () => {
    offerInstall();
    await repos().settings.set('installCardDismissed', true);
    renderApp('/settings');
    expect(await screen.findByRole('heading', { name: 'Install the app' })).toBeTruthy();
  });
});
