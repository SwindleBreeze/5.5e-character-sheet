import { describe, expect, it } from 'vitest';
import type { Spell } from '../../schema/index.ts';
import { normalizeEntries } from './entries.ts';
import { ReportBuilder } from './report.ts';
import { applySpellLists } from './spellLists.ts';
import { mergeSubraces, subraceName } from './subraces.ts';

describe('normalizeEntries', () => {
  it('keeps strings and maps block types onto our union', () => {
    expect(
      normalizeEntries([
        'text',
        { type: 'entries', name: 'A', entries: ['a'] },
        { type: 'insetReadaloud', entries: ['read'] },
        {
          type: 'list',
          style: 'list-hang-notitle',
          items: [{ type: 'item', name: 'X:', entry: 'x' }],
        },
        { type: 'quote', entries: ['q'], by: 'Someone' },
        { type: 'image', href: {} },
      ]),
    ).toEqual([
      'text',
      { type: 'entries', name: 'A', entries: ['a'] },
      { type: 'inset', entries: ['read'] },
      { type: 'list', style: 'none', items: [{ type: 'item', name: 'X:', entries: ['x'] }] },
      { type: 'quote', entries: ['q'], by: 'Someone' },
    ]);
  });

  it('turns feature references into refs and options into options blocks', () => {
    expect(
      normalizeEntries([
        {
          type: 'options',
          count: 1,
          entries: [
            { type: 'refClassFeature', classFeature: 'Crowd Pleaser|Gladiator|TST|1' },
            { type: 'refOptionalfeature', optionalfeature: 'Taunt|TST' },
          ],
        },
      ]),
    ).toEqual([
      {
        type: 'options',
        count: 1,
        entries: [
          { type: 'ref', ref: { kind: 'classFeature', id: 'crowd pleaser|gladiator|tst|1|tst' } },
          { type: 'ref', ref: { kind: 'optionalFeature', id: 'taunt|tst' } },
        ],
      },
    ]);
  });

  it('flattens tables with roll cells', () => {
    expect(
      normalizeEntries([
        {
          type: 'table',
          caption: 'Roll',
          colLabels: ['d4', 'Result'],
          rows: [
            [{ type: 'cell', roll: { min: 1, max: 2 } }, 'Low'],
            [{ type: 'cell', roll: { exact: 3 } }, 'Mid'],
          ],
        },
      ]),
    ).toEqual([
      {
        type: 'table',
        caption: 'Roll',
        colLabels: ['d4', 'Result'],
        rows: [
          ['1–2', 'Low'],
          ['3', 'Mid'],
        ],
      },
    ]);
  });

  it('writes spellcasting formula blocks as text and keeps unknown blocks', () => {
    expect(
      normalizeEntries([
        { type: 'abilityDc', name: 'Spell', attributes: ['cha'] },
        { type: 'mystery', foo: 1 },
      ]),
    ).toEqual([
      '{@b Spell save DC} = 8 + your Proficiency Bonus + your Charisma modifier',
      { type: 'unknown', raw: { type: 'mystery', foo: 1 } },
    ]);
  });
});

describe('subraces', () => {
  it('names subraces like 5etools', () => {
    expect(subraceName('Elfish', 'Tall')).toBe('Elfish (Tall)');
    expect(subraceName('Drake (Red)', 'Old')).toBe('Drake (Red; Old)');
  });

  it('a nameless subrace replaces its race; entries can overwrite by name', () => {
    const report = new ReportBuilder();
    const out = mergeSubraces(
      [
        {
          name: 'Human',
          source: 'OLD',
          entries: [{ name: 'Skill', entries: ['one'] }],
          ability: [{ str: 1 }],
        },
      ],
      [
        {
          source: 'OLD',
          raceName: 'Human',
          raceSource: 'OLD',
          ability: [{ dex: 1 }],
          entries: [{ name: 'Skills', entries: ['two'], data: { overwrite: 'Skill' } }],
        },
        { name: 'Lost', source: 'OLD', raceName: 'Nobody', raceSource: 'OLD' },
      ],
      report,
    );
    expect(out).toEqual([
      {
        name: 'Human',
        source: 'OLD',
        entries: [{ name: 'Skills', entries: ['two'], data: { overwrite: 'Skill' } }],
        ability: [{ str: 1, dex: 1 }],
      },
    ]);
    expect(report.report.warnings.map((w) => w.code)).toEqual(['subraceOrphan']);
  });
});

describe('applySpellLists', () => {
  const spell = (name: string, source: string) =>
    ({ name, source, classIds: [], subclassIds: [] }) as unknown as Spell;

  it('reads the older spells/sources.json format', () => {
    const spells = [spell('Glow', 'TST')];
    applySpellLists(spells, {
      format: 'sources',
      data: {
        TST: {
          Glow: {
            class: [
              { name: 'Gladiator', source: 'TST' },
              { name: 'Bard', source: 'OLD' },
            ],
          },
        },
      },
    });
    expect(spells[0]?.classIds).toEqual(['bard|old', 'gladiator|tst']);
  });

  it('leaves spells without an entry alone', () => {
    const spells = [spell('Unknown', 'TST')];
    applySpellLists(spells, { format: 'gendata', data: {} });
    expect(spells[0]?.classIds).toEqual([]);
  });
});
