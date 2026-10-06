import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { fixtureFiles } from '../../test/fivetoolsFixture.ts';
import { fileListSource } from './fs/fileList.ts';
import { memoryFileSource } from './fs/memory.ts';
import { childrenOf } from './fs/types.ts';
import { zipFileSource } from './fs/zip.ts';
import { importFivetools } from './index.ts';
import { locateDataRoot } from './locate.ts';

describe('file sources', () => {
  it('childrenOf lists direct files and folders', () => {
    const paths = ['a/x.json', 'a/b/y.json', 'a/b/c/z.json', 'top.json'];
    expect(childrenOf(paths, '')).toEqual(['a/', 'top.json']);
    expect(childrenOf(paths, 'a')).toEqual(['b/', 'x.json']);
    expect(childrenOf(paths, 'a/b/')).toEqual(['c/', 'y.json']);
  });

  it('memory source reads files and returns null for missing ones', async () => {
    const fs = memoryFileSource({ 'a/b.json': '{}' });
    expect(await fs.readText('a/b.json')).toBe('{}');
    expect(await fs.readText('nope.json')).toBeNull();
  });

  it('file list source uses webkitRelativePath', async () => {
    const file = new File(['{"x":1}'], 'b.json');
    Object.defineProperty(file, 'webkitRelativePath', { value: 'picked/a/b.json' });
    const fs = fileListSource([file]);
    expect(await fs.listDir('picked/')).toEqual(['a/']);
    expect(await fs.readText('picked/a/b.json')).toBe('{"x":1}');
  });

  it('zip source imports the same as the folder it was made from', async () => {
    const zip = new JSZip();
    for (const [path, text] of Object.entries(fixtureFiles('5etools-v9/data/')))
      zip.file(path, text);
    const bytes = await zip.generateAsync({ type: 'uint8array' });

    const fromZip = await importFivetools(await zipFileSource(bytes), { now: 1 });
    const fromFolder = await importFivetools(memoryFileSource(fixtureFiles()), { now: 1 });
    expect(fromZip.entities).toEqual(fromFolder.entities);
  });
});

describe('locateDataRoot', () => {
  const data = { 'class/index.json': '{}', 'spells/index.json': '{}' };
  const at = (prefix: string) =>
    memoryFileSource(Object.fromEntries(Object.entries(data).map(([k, v]) => [prefix + k, v])));

  it.each(['', 'data/', 'repo/data/', 'zip-root/repo/data/'])(
    'finds the root at "%s"',
    async (prefix) => {
      expect(await locateDataRoot(at(prefix))).toBe(prefix);
    },
  );

  it('prefers data/ over sibling folders', async () => {
    const fs = memoryFileSource({
      'repo/aaa/class/x.json': '{}',
      'repo/data/class/index.json': '{}',
      'repo/data/spells/index.json': '{}',
    });
    expect(await locateDataRoot(fs)).toBe('repo/data/');
  });

  it('returns null when nothing looks like 5etools data', async () => {
    expect(await locateDataRoot(memoryFileSource({ 'a/b/c.json': '{}' }))).toBeNull();
  });
});
