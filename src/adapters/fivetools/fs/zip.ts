import type JSZip from 'jszip';
import { childrenOf, type FileSource } from './types.ts';

/**
 * FileSource over a zip archive (e.g. the 5etools release zip). JSZip is loaded on demand and
 * entries are inflated only when read.
 */
export async function zipFileSource(data: Blob | ArrayBuffer | Uint8Array): Promise<FileSource> {
  const { default: JSZipCtor } = await import('jszip');
  const zip: JSZip = await JSZipCtor.loadAsync(data);
  const paths = Object.values(zip.files)
    .filter((f) => !f.dir)
    .map((f) => f.name);
  return {
    async readText(path) {
      const file = zip.file(path);
      return file ? file.async('string') : null;
    },
    async listDir(path) {
      return childrenOf(paths, path);
    },
  };
}
