// Read-only view of a folder of files, whatever it came from: a picked directory, a
// `webkitdirectory` file list, a zip, or memory (tests). Paths use `/` and have no leading `/`.

export interface FileSource {
  /** File text, or null if there is no such file. */
  readText(path: string): Promise<string | null>;
  /** Direct children of a folder (`''` is the root). Folder names end with `/`. */
  listDir(path: string): Promise<string[]>;
}

/** Normalize a folder path to `''` or `a/b/`. */
export function folderPath(path: string): string {
  const trimmed = path.replace(/\\/g, '/').replace(/^\/+/, '');
  return trimmed === '' || trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

/** Direct children of `folder` in a flat list of file paths. */
export function childrenOf(paths: Iterable<string>, folder: string): string[] {
  const prefix = folderPath(folder);
  const out = new Set<string>();
  for (const path of paths) {
    if (!path.startsWith(prefix)) continue;
    const rest = path.slice(prefix.length);
    const slash = rest.indexOf('/');
    out.add(slash < 0 ? rest : rest.slice(0, slash + 1));
  }
  out.delete('');
  return [...out].sort();
}
