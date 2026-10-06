import { describe, expect, it } from 'vitest';
import {
  identityKey,
  parseClassFeatureUid,
  parseNameSourceUid,
  parseSubclassFeatureUid,
  parseSubclassUid,
  uidToId,
} from './uid.ts';

describe('UIDs', () => {
  it('fills the default source for name|source', () => {
    expect(parseNameSourceUid('Torch', 'DMG')).toEqual({ name: 'Torch', source: 'DMG' });
    expect(parseNameSourceUid('Torch|TST|a torch', 'DMG')).toEqual({
      name: 'Torch',
      source: 'TST',
    });
  });

  it('class features: class source defaults to PHB, source to the class source', () => {
    expect(parseClassFeatureUid('Rage|Barbarian||1')).toEqual({
      name: 'Rage',
      className: 'Barbarian',
      classSource: 'PHB',
      level: 1,
      source: 'PHB',
    });
    expect(parseClassFeatureUid('Rage|Barbarian|TST|1').source).toBe('TST');
  });

  it('subclass features: empty fields fall back to defaults', () => {
    expect(parseSubclassFeatureUid('Ward|Wizard||Abjuration||6')).toEqual({
      name: 'Ward',
      className: 'Wizard',
      classSource: 'PHB',
      subclassShortName: 'Abjuration',
      subclassSource: 'PHB',
      level: 6,
      source: 'PHB',
    });
    expect(parseSubclassFeatureUid('Tangle|Gladiator|TST|Net|OLD|3').source).toBe('OLD');
  });

  it('subclasses', () => {
    expect(parseSubclassUid('Net|Gladiator')).toEqual({
      shortName: 'Net',
      className: 'Gladiator',
      classSource: 'PHB',
      source: 'PHB',
    });
  });

  it('turns UIDs into lowercase ids', () => {
    expect(uidToId.classFeature('Action Surge|Fighter|TST|2')).toBe(
      'action surge|fighter|tst|2|tst',
    );
    expect(uidToId.subclass('Net|Gladiator|TST|TST')).toBe('net|gladiator|tst|tst');
    expect(uidToId.nameSource('Torch', 'DMG')).toBe('torch|dmg');
  });

  it('deities: name|pantheon|source, defaulting to Forgotten Realms and PHB', () => {
    expect(uidToId.deity('Mirela')).toBe('mirela|forgotten realms|phb');
    expect(uidToId.deity('Brask|Seafolk')).toBe('brask|seafolk|phb');
    expect(uidToId.deity('Brask|Seafolk|TST')).toBe('brask|seafolk|tst');
    expect(identityKey('deity', { name: 'Brask', pantheon: 'Seafolk', source: 'TST' })).toBe(
      'brask|seafolk|tst',
    );
  });

  it('identity keys follow the type UID fields', () => {
    expect(
      identityKey('subclass', {
        name: 'School',
        shortName: 'Net',
        className: 'G',
        classSource: 'TST',
        source: 'TST',
      }),
    ).toBe('net|g|tst|tst');
    expect(identityKey('magicvariant', { name: '+1 X', inherits: { source: 'TST' } })).toBe(
      '+1 x|tst',
    );
    expect(identityKey('feat', { name: 'A', source: 'B' })).toBe('a|b');
  });
});
