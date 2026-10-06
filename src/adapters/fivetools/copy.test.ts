import { describe, expect, it } from 'vitest';
import { resolveCopies } from './copy.ts';
import type { RawEntity } from './raw.ts';
import { ReportBuilder } from './report.ts';
import { expandVersions } from './versions.ts';

function resolve(records: Record<string, RawEntity[]>) {
  const report = new ReportBuilder();
  resolveCopies(records, report);
  return { records, warnings: report.report.warnings.map((w) => `${w.code} ${w.entity ?? ''}`) };
}

describe('resolveCopies', () => {
  it('copies parent fields the child lacks and applies _mod', () => {
    const { records } = resolve({
      feat: [
        { name: 'Base', source: 'OLD', category: 'G', entries: ['a'] },
        {
          name: 'Child',
          source: 'TST',
          _copy: {
            name: 'Base',
            source: 'OLD',
            _mod: { entries: { mode: 'appendArr', items: 'b' } },
          },
        },
      ],
    });
    expect(records.feat?.[1]).toEqual({
      name: 'Child',
      source: 'TST',
      category: 'G',
      entries: ['a', 'b'],
    });
  });

  it('only copies page, reprints and similar fields when _preserve asks', () => {
    const parent = { name: 'Base', source: 'OLD', page: 4, reprintedAs: ['X|TST'], srd: true };
    const { records } = resolve({
      feat: [
        parent,
        { name: 'A', source: 'TST', _copy: { name: 'Base', source: 'OLD' } },
        {
          name: 'B',
          source: 'TST',
          _copy: { name: 'Base', source: 'OLD', _preserve: { page: true } },
        },
        {
          name: 'C',
          source: 'TST',
          _copy: { name: 'Base', source: 'OLD', _preserve: { '*': true } },
        },
      ],
    });
    expect(records.feat?.[1]).toEqual({ name: 'A', source: 'TST' });
    expect(records.feat?.[2]).toEqual({ name: 'B', source: 'TST', page: 4 });
    expect(records.feat?.[3]).toEqual({ ...parent, name: 'C', source: 'TST' });
  });

  it('null in the child removes the parent field', () => {
    const { records } = resolve({
      feat: [
        { name: 'Base', source: 'OLD', prerequisite: [{ level: 4 }] },
        { name: 'C', source: 'TST', prerequisite: null, _copy: { name: 'Base', source: 'OLD' } },
      ],
    });
    expect(records.feat?.[1]).toEqual({ name: 'C', source: 'TST' });
  });

  it('resolves chains in any order', () => {
    const { records } = resolve({
      feat: [
        {
          name: 'C',
          source: 'TST',
          _copy: { name: 'B', source: 'TST', _mod: { tags: { mode: 'appendArr', items: 'c' } } },
        },
        {
          name: 'B',
          source: 'TST',
          _copy: { name: 'A', source: 'TST', _mod: { tags: { mode: 'appendArr', items: 'b' } } },
        },
        { name: 'A', source: 'TST', tags: ['a'] },
      ],
    });
    expect(records.feat?.[0]).toEqual({ name: 'C', source: 'TST', tags: ['a', 'b', 'c'] });
  });

  it('drops and reports cycles and missing parents', () => {
    const { records, warnings } = resolve({
      feat: [
        { name: 'A', source: 'TST', _copy: { name: 'B', source: 'TST' } },
        { name: 'B', source: 'TST', _copy: { name: 'A', source: 'TST' } },
        { name: 'Lost', source: 'TST', _copy: { name: 'Nowhere', source: 'TST' } },
        { name: 'Fine', source: 'TST' },
      ],
    });
    expect(records.feat?.map((f) => f.name)).toEqual(['Fine']);
    expect(warnings).toContain('copyCycle A|TST');
    expect(warnings).toContain('copyMissing Lost|TST');
  });

  it('finds subclass parents by their full UID and re-homes them', () => {
    const { records } = resolve({
      subclass: [
        {
          name: 'Way',
          shortName: 'Way',
          source: 'OLD',
          className: 'Monk',
          classSource: 'OLD',
          features: ['f'],
        },
        {
          className: 'Monk',
          classSource: 'TST',
          _copy: {
            name: 'Way',
            shortName: 'Way',
            source: 'OLD',
            className: 'Monk',
            classSource: 'OLD',
          },
        },
      ],
    });
    expect(records.subclass?.[1]).toEqual({
      name: 'Way',
      shortName: 'Way',
      source: 'OLD',
      className: 'Monk',
      classSource: 'TST',
      features: ['f'],
    });
  });

  it('lets items copy base items', () => {
    const { records } = resolve({
      baseitem: [{ name: 'Torch', source: 'TST', weight: 1 }],
      item: [{ name: 'Magic Torch', source: 'TST', _copy: { name: 'Torch', source: 'TST' } }],
    });
    expect(records.item?.[0]).toEqual({ name: 'Magic Torch', source: 'TST', weight: 1 });
  });
});

describe('expandVersions', () => {
  it('expands plain versions, inheriting everything but versions and fluff flags', () => {
    const report = new ReportBuilder();
    const parent: RawEntity = {
      name: 'Elfish',
      source: 'TST',
      page: 3,
      hasFluff: true,
      entries: [{ name: 'Lineage', entries: ['pick'] }],
      _versions: [
        {
          name: 'Elfish; Tall',
          source: 'TST',
          _mod: { entries: { mode: 'removeArr', names: 'Lineage' } },
          tall: true,
        },
      ],
    };
    const [v] = expandVersions(parent, report);
    expect(v).toEqual({
      name: 'Elfish; Tall',
      source: 'TST',
      page: 3,
      entries: [],
      tall: true,
      __versionOf: { name: 'Elfish', source: 'TST' },
    });
  });

  it('fills {{variables}} from each implementation', () => {
    const report = new ReportBuilder();
    const versions = expandVersions(
      {
        name: 'Drake',
        source: 'TST',
        entries: ['Breath.'],
        _versions: [
          {
            _abstract: {
              name: 'Drake ({{c}})',
              source: 'TST',
              _mod: { entries: { mode: 'appendArr', items: '{{c}} {{missing}}' } },
            },
            _implementations: [
              { _variables: { c: 'Red' }, resist: ['fire'] },
              { _variables: { c: 'Blue' } },
            ],
          },
        ],
      },
      report,
    );
    expect(versions.map((v) => [v.name, v.entries, v.resist])).toEqual([
      ['Drake (Red)', ['Breath.', 'Red {{missing}}'], ['fire']],
      ['Drake (Blue)', ['Breath.', 'Blue {{missing}}'], undefined],
    ]);
  });
});
