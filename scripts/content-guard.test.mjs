import { describe, expect, it } from 'vitest';
import { FILE_MAX_BYTES, FIXTURE_MAX_BYTES, findViolations } from './content-guard-core.mjs';

function check(files) {
  const paths = Object.keys(files);
  return findViolations(
    paths,
    (p) => files[p],
    (p) => (typeof files[p] === 'number' ? files[p] : files[p].length),
  ).map((v) => v.path);
}

describe('content guard', () => {
  it('passes ordinary source and config files', () => {
    expect(
      check({
        'src/main.tsx': 'export {}',
        'package.json': '{"name":"x","scripts":{}}',
        'tsconfig.json': '{"files":[]}',
      }),
    ).toEqual([]);
  });

  it('rejects forbidden paths', () => {
    expect(
      check({
        'data/spells.json': '{}',
        'public/srd.pack.json': '{}',
        'shared/group.pack.json.gz': 'x',
        '5etools-src-2.36.1/data/x.json': '{}',
        'backup.zip': 'x',
      }),
    ).toEqual([
      'data/spells.json',
      'public/srd.pack.json',
      'shared/group.pack.json.gz',
      '5etools-src-2.36.1/data/x.json',
      'backup.zip',
    ]);
  });

  it('rejects JSON that looks like 5etools data or a pack, anywhere outside fixtures', () => {
    expect(
      check({
        'src/stuff.json': '{"spell":[{"name":"Zap"}]}',
        'docs/export.json': '{"format":"5e-sheet-pack","entities":{}}',
      }),
    ).toEqual(['src/stuff.json', 'docs/export.json']);
  });

  it('allows marked, small hand-written fixtures and rejects unmarked or large ones', () => {
    const big = `{"_fixture":true,"spell":[],"pad":"${'x'.repeat(FIXTURE_MAX_BYTES)}"}`;
    expect(
      check({
        'tests/fixtures/fivetools/spells/spells-tst.json': '{"_fixture":true,"spell":[]}',
        'tests/fixtures/fivetools/feats.json': '{"feat":[]}',
        'tests/fixtures/fivetools/big.json': big,
      }),
    ).toEqual(['tests/fixtures/fivetools/feats.json', 'tests/fixtures/fivetools/big.json']);
  });

  it('rejects very large files except the lockfile', () => {
    expect(
      check({
        'package-lock.json': FILE_MAX_BYTES + 1,
        'src/huge.ts': FILE_MAX_BYTES + 1,
      }),
    ).toEqual(['src/huge.ts']);
  });
});
