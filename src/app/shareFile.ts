// Hand a generated file to the user: the share sheet where it can take files (iOS, Android: Save
// to Files, AirDrop, chat apps), otherwise a normal download.

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

export async function shareOrDownload(
  data: BlobPart,
  fileName: string,
  type: string,
): Promise<ShareOutcome> {
  const file = new File([data], fileName, { type });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
      // Some browsers refuse at the last moment; fall back to a download.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.append(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
  return 'downloaded';
}
