import { describe, expect, it } from 'vitest';
import type { SourceInfo } from '../../schema/index.ts';
import { groupBySource } from './sources.ts';

const source = (code: string, name: string, group: SourceInfo['group'], published: string) =>
  ({ code, name, group, published }) as SourceInfo;

describe('content by book (plan §9.3b, step 4B.6)', () => {
  it('core books first, newest first; then the others by name; names sorted within', () => {
    const sources = [
      source('OLDCORE', 'Old Core Book', 'core', '2014-08-19'),
      source('NEWCORE', 'New Core Book', 'core', '2024-09-17'),
      source('ZED', 'Zed Supplement', 'supplement', '2025-01-01'),
      source('ABC', 'Abc Setting', 'supplement', '2020-01-01'),
    ];
    const groups = groupBySource(
      [
        { name: 'Wren', source: 'ZED' },
        { name: 'Moth', source: 'NEWCORE' },
        { name: 'Ant', source: 'NEWCORE' },
        { name: 'Owl', source: 'ABC' },
        { name: 'Elk', source: 'OLDCORE' },
        { name: 'Yak', source: 'HOMEBREW' },
      ],
      sources,
    );
    expect(groups.map((g) => [g.label, g.core, g.items.map((i) => i.name)])).toEqual([
      ['New Core Book', true, ['Ant', 'Moth']],
      ['Old Core Book', true, ['Elk']],
      ['Abc Setting', false, ['Owl']],
      // Not registered: shown under its code.
      ['HOMEBREW', false, ['Yak']],
      ['Zed Supplement', false, ['Wren']],
    ]);
  });
});
