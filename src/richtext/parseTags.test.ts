import { describe, expect, it } from 'vitest';
import { splitByTags, tokenize, type TagToken } from './parseTags.ts';
import { refFromTag, stripTags, tagCategory, tagDisplay } from './tagRegistry.ts';

function tag(input: string): TagToken {
  const t = tokenize(input)[0];
  if (t?.type !== 'tag') throw new Error('not a tag');
  return t;
}

describe('tokenize', () => {
  it('returns plain text as one token', () => {
    expect(tokenize('Just text.')).toEqual([{ type: 'text', text: 'Just text.' }]);
  });

  it('returns nothing for an empty string', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('splits text and tags, with parts', () => {
    expect(tokenize('Cast {@spell Glow|TST} now.')).toEqual([
      { type: 'text', text: 'Cast ' },
      {
        type: 'tag',
        tag: 'spell',
        content: 'Glow|TST',
        parts: ['Glow', 'TST'],
        raw: '{@spell Glow|TST}',
      },
      { type: 'text', text: ' now.' },
    ]);
  });

  it('keeps nested tags inside one token and splits parts only at the top level', () => {
    const t = tag('{@b Use {@spell Glow|TST|the glow} well|x}');
    expect(t.parts).toEqual(['Use {@spell Glow|TST|the glow} well', 'x']);
  });

  it('handles tags without content', () => {
    expect(tag('{@h}')).toMatchObject({ tag: 'h', content: '', parts: [''] });
  });

  it('treats an unclosed tag as text', () => {
    expect(tokenize('a {@b broken')).toEqual([{ type: 'text', text: 'a {@b broken' }]);
  });

  it('ignores plain braces that are not tags', () => {
    expect(tokenize('{=bonusWeapon} to hit')).toEqual([
      { type: 'text', text: '{=bonusWeapon} to hit' },
    ]);
  });

  it('splitByTags round-trips the input', () => {
    const input = 'x {@a 1} y {@b {@c 2}} z';
    expect(splitByTags(input)).toEqual(['x ', '{@a 1}', ' y ', '{@b {@c 2}}', ' z']);
    expect(splitByTags(input).join('')).toBe(input);
  });
});

describe('tag display text', () => {
  it.each([
    ['{@spell Glow|TST}', 'Glow'],
    ['{@spell Glow|TST|a glow}', 'a glow'],
    ['{@item Net Blade|TST|net blades}', 'net blades'],
    ['{@filter Prepared Spells|spells|level=1}', 'Prepared Spells'],
    ['{@classFeature Rage|Barbarian|TST|1|TST|raging}', 'raging'],
    ['{@subclassFeature Tangle|Gladiator|TST|Net|TST|3}', 'Tangle'],
    ['{@variantrule Sphere [Area of Effect]|TST}', 'Sphere'],
    ['{@damage 2d6}', '2d6'],
    ['{@dice 1d20+5|roll it}', 'roll it'],
    ['{@hit 5}', '+5'],
    ['{@dc 15}', 'DC 15'],
    ['{@chance 25}', '25 percent'],
    ['{@recharge 5}', '(Recharge 5–6)'],
    ['{@recharge}', '(Recharge 6)'],
    ['{@atkr m}', 'Melee Attack Roll:'],
    ['{@actSave dex}', 'Dexterity Saving Throw:'],
    ['{@ability str 18}', '18 (+4)'],
    ['{@book Chapter 2|TST|2}', 'Chapter 2'],
  ])('%s → %s', (input, expected) => {
    expect(tagDisplay(tag(input))).toBe(expected);
  });

  it('stripTags resolves nested tags', () => {
    expect(stripTags('{@b Use {@spell Glow|TST|the glow}} now')).toBe('Use the glow now');
  });
});

describe('tag categories and refs', () => {
  it('categorises tags', () => {
    expect(tagCategory('spell')).toBe('entity');
    expect(tagCategory('damage')).toBe('roll');
    expect(tagCategory('b')).toBe('format');
    expect(tagCategory('filter')).toBe('text');
  });

  it('builds refs with the default source of the tag', () => {
    expect(refFromTag(tag('{@spell Glow}'))).toEqual({ kind: 'spell', id: 'glow|phb' });
    expect(refFromTag(tag('{@item Torch}'))).toEqual({ kind: 'item', id: 'torch|dmg' });
    expect(refFromTag(tag('{@race Mossling|TST}'))).toEqual({
      kind: 'species',
      id: 'mossling|tst',
    });
    expect(refFromTag(tag('{@condition Dazzled|TST}'))).toEqual({
      kind: 'rule',
      id: 'condition/dazzled|tst',
    });
    expect(refFromTag(tag('{@itemMastery Snare}'))).toEqual({
      kind: 'rule',
      id: 'mastery/snare|xphb',
    });
    expect(refFromTag(tag('{@b bold}'))).toBeNull();
  });

  it('links player extras (plan §6.12)', () => {
    expect(refFromTag(tag('{@deity Mirela}'))).toEqual({
      kind: 'deity',
      id: 'mirela|forgotten realms|phb',
    });
    expect(refFromTag(tag('{@deity Brask|Seafolk|TST|the Tide God}'))).toEqual({
      kind: 'deity',
      id: 'brask|seafolk|tst',
    });
    expect(tagDisplay(tag('{@deity Brask|Seafolk|TST|the Tide God}'))).toBe('the Tide God');
    expect(refFromTag(tag('{@reward Charm of Sparks|TST|Charm}'))).toEqual({
      kind: 'reward',
      id: 'charm of sparks|tst',
    });
    expect(refFromTag(tag('{@reward Blessing}'))?.id).toBe('blessing|dmg');
    expect(refFromTag(tag('{@facility Spark Forge}'))).toEqual({
      kind: 'facility',
      id: 'spark forge|xdmg',
    });
    expect(refFromTag(tag('{@charoption Gift of Echoes}'))).toEqual({
      kind: 'charOption',
      id: 'gift of echoes|mot',
    });
  });

  it('builds feature refs from their UID fields and defaults', () => {
    expect(refFromTag(tag('{@classFeature Rage|Barbarian|TST|1}'))).toEqual({
      kind: 'classFeature',
      id: 'rage|barbarian|tst|1|tst',
    });
    expect(refFromTag(tag('{@subclassFeature Ward|Wizard||Abjuration||6}'))).toEqual({
      kind: 'subclassFeature',
      id: 'ward|wizard|phb|abjuration|phb|6|phb',
    });
    expect(refFromTag(tag('{@subclass Net|Gladiator|TST|TST}'))).toEqual({
      kind: 'subclass',
      id: 'net|gladiator|tst|tst',
    });
  });
});
