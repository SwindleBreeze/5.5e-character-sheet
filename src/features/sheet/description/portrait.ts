// Portrait images (plan §9.2, step 3.21): a phone photo is several megabytes and goes into
// every backup, so it is scaled down before it is stored.

import { useLiveQuery } from 'dexie-react-hooks';
import { repos } from '../../../db/repos.ts';

/** Longest side of a stored portrait, in pixels: plenty for the sheet. */
export const PORTRAIT_SIZE = 512;

/**
 * The image scaled down to `PORTRAIT_SIZE` (WebP, or PNG where the browser can't write WebP).
 * Kept as it is when it is already small, or when the browser can't decode it here.
 */
export async function shrinkImage(file: Blob, size = PORTRAIT_SIZE): Promise<Blob> {
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas !== 'function') {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
    if (scale === 1) {
      bitmap.close();
      return file;
    }
    const canvas = new OffscreenCanvas(
      Math.round(bitmap.width * scale),
      Math.round(bitmap.height * scale),
    );
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await canvas.convertToBlob({ type: 'image/webp', quality: 0.85 });
  } catch {
    return file;
  }
}

function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the portrait'));
    reader.readAsDataURL(blob);
  });
}

/**
 * A stored portrait as a data URL (a scaled-down portrait is small), so there is no object URL
 * to release. The database read comes first: Dexie only watches reads made before other awaits.
 */
export function usePortraitUrl(id: string | undefined): string | undefined {
  return useLiveQuery(async () => {
    const blob = id ? await repos().characters.portrait(id) : undefined;
    // A portrait that can't be read is left out rather than breaking the tab.
    return blob ? dataUrl(blob).catch(() => undefined) : undefined;
  }, [id]);
}
