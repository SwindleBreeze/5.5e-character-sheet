import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FileButton } from './FileButton.tsx';

const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';

const pack = new File(['{}'], 'group.pack.json.gz');

afterEach(() => {
  delete (window as { showOpenFilePicker?: unknown }).showOpenFilePicker;
});

describe('FileButton', () => {
  it('opens the Files app directly on Android when the browser can', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ANDROID);
    const picker = vi.fn().mockResolvedValue([{ getFile: () => Promise.resolve(pack) }]);
    (window as { showOpenFilePicker?: unknown }).showOpenFilePicker = picker;
    const onFiles = vi.fn();
    render(
      <FileButton accept=".gz,application/gzip" onFiles={onFiles}>
        Open pack file
      </FileButton>,
    );
    fireEvent.click(screen.getByLabelText('Open pack file'));
    await waitFor(() => expect(onFiles).toHaveBeenCalledWith([pack]));
    expect(picker).toHaveBeenCalledWith({ multiple: false });
  });

  it('uses the file input elsewhere', () => {
    const onFiles = vi.fn();
    render(
      <FileButton accept=".gz,application/gzip" onFiles={onFiles}>
        Open pack file
      </FileButton>,
    );
    const input = screen.getByLabelText<HTMLInputElement>('Open pack file');
    expect(input.accept).toBe('.gz,application/gzip');
    fireEvent.change(input, { target: { files: [pack] } });
    expect(onFiles).toHaveBeenCalledWith([pack]);
  });
});
