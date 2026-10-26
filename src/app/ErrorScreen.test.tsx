import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorScreen.tsx';
import { RELEASE } from './release.ts';

function Broken(): never {
  throw new Error('The roof fell in');
}

describe('the error screen', () => {
  it('says what happened instead of a blank page, and copies details for a report', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const user = userEvent.setup();
    // After setup, which puts in a clipboard of its own.
    const writeText = vi.fn((_text: string) => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    );
    const alert = within(screen.getByRole('alert'));
    expect(alert.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(alert.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    await user.click(alert.getByRole('button', { name: 'Copy details' }));
    const details = writeText.mock.calls[0]![0];
    expect(details).toContain(`${RELEASE.name} ${RELEASE.version}`);
    expect(details).toContain('Error: Error: The roof fell in');
    expect(await alert.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });
});
