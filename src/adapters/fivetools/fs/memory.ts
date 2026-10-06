import { childrenOf, type FileSource } from './types.ts';

/** FileSource over an in-memory map of path → text. Used by tests. */
export function memoryFileSource(files: Record<string, string>): FileSource {
  const paths = Object.keys(files);
  return {
    async readText(path) {
      return files[path] ?? null;
    },
    async listDir(path) {
      return childrenOf(paths, path);
    },
  };
}
