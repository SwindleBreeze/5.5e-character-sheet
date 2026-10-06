import { folderPath, type FileSource } from './types.ts';

/** True where the File System Access API can pick a folder (desktop Chromium). */
export function canPickDirectory(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

async function resolveDir(
  root: FileSystemDirectoryHandle,
  segments: string[],
): Promise<FileSystemDirectoryHandle | null> {
  let dir = root;
  for (const name of segments) {
    try {
      dir = await dir.getDirectoryHandle(name);
    } catch {
      return null;
    }
  }
  return dir;
}

/** FileSource over a folder picked with `showDirectoryPicker()`. Only visited folders are read. */
export function dirHandleSource(root: FileSystemDirectoryHandle): FileSource {
  return {
    async readText(path) {
      const segments = path.split('/').filter(Boolean);
      const fileName = segments.pop();
      if (!fileName) return null;
      const dir = await resolveDir(root, segments);
      if (!dir) return null;
      try {
        const handle = await dir.getFileHandle(fileName);
        return (await handle.getFile()).text();
      } catch {
        return null;
      }
    },
    async listDir(path) {
      const dir = await resolveDir(root, folderPath(path).split('/').filter(Boolean));
      if (!dir) return [];
      const names: string[] = [];
      for await (const handle of dir.values()) {
        names.push(handle.kind === 'directory' ? `${handle.name}/` : handle.name);
      }
      return names.sort();
    },
  };
}
