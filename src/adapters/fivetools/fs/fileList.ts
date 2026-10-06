import { childrenOf, type FileSource } from './types.ts';

/** FileSource over files picked with `<input type="file" webkitdirectory>`. */
export function fileListSource(files: Iterable<File>): FileSource {
  const byPath = new Map<string, File>();
  for (const file of files) {
    const path = (file.webkitRelativePath || file.name).replace(/\\/g, '/');
    byPath.set(path, file);
  }
  return {
    async readText(path) {
      const file = byPath.get(path);
      return file ? file.text() : null;
    },
    async listDir(path) {
      return childrenOf(byPath.keys(), path);
    },
  };
}
