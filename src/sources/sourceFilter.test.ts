import { describe, expect, it } from 'vitest';
import type { Edition, SourceInfo, Spell } from '../schema/index.ts';
import {
  availableOf,
  effectiveSources,
  groupSources,
  isAvailable,
  presetSources,
  sourceOffersKind,
} from './sourceFilter.ts';

function spell(id: string, source: string, edition: Edition, supersededBy?: string[]): Spell {
  return { id, source, edition, ...(supersededBy ? { supersededBy } : {}) } as Spell;
}

function info(code: string, edition: Edition, group: SourceInfo['group']): SourceInfo {
  return {
    code,
    name: code,
    edition,
    group,
    counts: {},
    importedAt: 0,
    adapterVersion: 1,
    origin: '5etools',
  };
}

describe('sourceFilter', () => {
  const enabled = new Set(['TST', 'OLD', 'SUP']);
  const always = { enabled, isAvailableId: () => true };

  it('hides disabled sources', () => {
    expect(isAvailable(spell('a|x', 'X', '2024'), always)).toBe(false);
  });

  it('hides 2014 content, including 2014 subclasses re-homed onto 2024 classes', () => {
    expect(isAvailable(spell('a|old', 'OLD', '2014'), always)).toBe(false);
    expect(isAvailable(spell('a|tst', 'TST', '2024'), always)).toBe(true);
    expect(isAvailable(spell('a|sup', 'SUP', 'unknown'), always)).toBe(true);
  });

  it('hides content superseded by an available reprint, but not by an unavailable one', () => {
    const list = [
      spell('glow|sup', 'SUP', 'unknown', ['glow|tst']),
      spell('glow|tst', 'TST', '2024'),
      spell('dim|sup', 'SUP', 'unknown', ['dim|gone']),
    ];
    expect(availableOf(list, enabled).map((s) => s.id)).toEqual(['glow|tst', 'dim|sup']);
    expect(availableOf(list, new Set(['SUP'])).map((s) => s.id)).toEqual(['glow|sup', 'dim|sup']);
  });

  it('deities follow the source switches like any other kind', () => {
    const deity = (id: string, source: string, edition: Edition, supersededBy?: string[]) =>
      ({ ...spell(id, source, edition, supersededBy), kind: 'deity' }) as unknown as Spell;
    const list = [
      deity('mirela|faerûnian|sup', 'SUP', '2024', ['mirela|faerûnian|tst']),
      deity('mirela|faerûnian|tst', 'TST', '2024'),
      deity('brask|seafolk|old', 'OLD', '2014'),
    ];
    expect(availableOf(list, new Set(['SUP', 'TST', 'OLD'])).map((d) => d.id)).toEqual([
      'mirela|faerûnian|tst',
    ]);
    expect(availableOf(list, new Set(['SUP'])).map((d) => d.id)).toEqual(['mirela|faerûnian|sup']);
  });

  it('a kind has a library tab only when a usable source has some', () => {
    const withCounts = (s: SourceInfo, counts: SourceInfo['counts']) => ({ ...s, counts });
    const old = withCounts(info('OLD', '2014', 'core'), { charOption: 3, deity: 2 });
    const tst = withCounts(info('TST', '2024', 'core'), { reward: 1 });
    expect(sourceOffersKind(old, 'charOption')).toBe(false);
    expect(sourceOffersKind(old, 'deity')).toBe(false);
    expect(sourceOffersKind(tst, 'reward')).toBe(true);
    expect(sourceOffersKind(tst, 'facility')).toBe(false);
  });

  it('a character override replaces the global list', () => {
    expect([...effectiveSources(['TST'], null)]).toEqual(['TST']);
    expect([...effectiveSources(['TST'], { enabledSources: null })]).toEqual(['TST']);
    expect([...effectiveSources(['TST'], { enabledSources: ['SUP'] })]).toEqual(['SUP']);
  });

  it('groups sources for settings, with 2014 sources last in each group', () => {
    const groups = groupSources([
      info('ADV', '2014', 'adventure'),
      info('OLD', '2014', 'core'),
      info('TST', '2024', 'core'),
      info('SUP', '2024', 'supplement'),
    ]);
    expect(groups.map((g) => [g.title, g.sources.map((s) => s.code)])).toEqual([
      ['Core 2024', ['TST', 'OLD']],
      ['Supplements', ['SUP']],
      ['Adventures', ['ADV']],
    ]);
  });

  it('presets', () => {
    const sources = [
      info('TST', '2024', 'core'),
      info('SUP', '2024', 'supplement'),
      info('OLD', '2014', 'core'),
    ];
    expect(presetSources(sources, 'core2024')).toEqual(['TST']);
    expect(presetSources(sources, 'all2024')).toEqual(['SUP', 'TST']);
  });
});
