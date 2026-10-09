// A button that opens files. On Android, Chrome sends a file input through a chooser that offers
// "Photos & videos" and the camera next to Files, whatever `accept` says; `showOpenFilePicker`
// opens the Files app directly, so it is used there when the browser has it. Elsewhere, and on
// an Android browser without it, the file input opens the picker as before.

import type { ChangeEvent, ReactNode } from 'react';
import { fileAccept, isAndroid } from './fileAccept.ts';

interface OpenFilePicker {
  (options?: { multiple?: boolean }): Promise<{ getFile(): Promise<File> }[]>;
}

/** Turned off for this visit once the picker has refused (the file input takes over). */
let documentPickerBroken = false;

function documentPicker(): OpenFilePicker | null {
  if (documentPickerBroken || !isAndroid(navigator.userAgent)) return null;
  const picker = (window as { showOpenFilePicker?: OpenFilePicker }).showOpenFilePicker;
  return typeof picker === 'function' ? picker.bind(window) : null;
}

export function FileButton({
  accept,
  multiple = false,
  disabled = false,
  className,
  onFiles,
  children,
}: {
  /** Extensions and MIME types, as for a file input's `accept`. */
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
  onFiles: (files: File[]) => void;
  children: ReactNode;
}) {
  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    if (files.length) onFiles(files);
  }

  function onClick(e: React.MouseEvent<HTMLInputElement>) {
    const picker = documentPicker();
    if (!picker) return;
    e.preventDefault();
    picker({ multiple })
      .then((handles) => Promise.all(handles.map((h) => h.getFile())))
      .then((files) => files.length && onFiles(files))
      .catch((err: unknown) => {
        // Closing the picker is an AbortError; anything else, the file input is used next time.
        if (!(err instanceof DOMException && err.name === 'AbortError'))
          documentPickerBroken = true;
      });
  }

  return (
    <label className={className} data-disabled={disabled || undefined}>
      <input
        type="file"
        accept={fileAccept(accept)}
        multiple={multiple}
        disabled={disabled}
        onChange={onChange}
        onClick={onClick}
      />
      {children}
    </label>
  );
}
