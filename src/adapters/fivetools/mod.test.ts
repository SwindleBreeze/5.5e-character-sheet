import { describe, expect, it } from 'vitest';
import { applyMods, type ModWarn } from './mod.ts';
import type { RawObject } from './raw.ts';

function mod(target: RawObject, mods: unknown) {
  const warnings: string[] = [];
  const warn: ModWarn = (code, message) => warnings.push(`${code}: ${message}`);
  applyMods(target, mods, warn);
  return { target, warnings };
}

const named = (...names: string[]) => names.map((name) => ({ name, entries: [`${name} text`] }));

describe('applyMods', () => {
  it('appendArr, prependArr and insertArr', () => {
    const { target } = mod(
      { entries: ['b'] },
      {
        entries: [
          { mode: 'appendArr', items: 'c' },
          { mode: 'prependArr', items: ['a'] },
          { mode: 'insertArr', index: 1, items: 'a2' },
          { mode: 'insertArr', index: -1, items: 'end' },
        ],
      },
    );
    expect(target.entries).toEqual(['a', 'a2', 'b', 'c', 'end']);
  });

  it('appendArr creates a missing array', () => {
    expect(mod({}, { traits: { mode: 'appendArr', items: 'x' } }).target).toEqual({
      traits: ['x'],
    });
  });

  it('appendIfNotExistsArr skips deep-equal items', () => {
    const { target } = mod(
      { property: ['V|TST'] },
      {
        property: { mode: 'appendIfNotExistsArr', items: ['V|TST', 'F|TST'] },
      },
    );
    expect(target.property).toEqual(['V|TST', 'F|TST']);
  });

  it('replaceArr by name, by regex and by index', () => {
    const { target } = mod(
      { entries: named('One', 'Two', 'Three') },
      {
        entries: [
          { mode: 'replaceArr', replace: 'Two', items: { name: 'Second' } },
          { mode: 'replaceArr', replace: { regex: '^Th' }, items: [{ name: 'Third' }] },
          { mode: 'replaceArr', replace: { index: 0 }, items: 'first' },
        ],
      },
    );
    expect(target.entries).toEqual(['first', { name: 'Second' }, { name: 'Third' }]);
  });

  it('replaceArr reports a missing item and leaves the array alone', () => {
    const { target, warnings } = mod(
      { entries: named('One') },
      {
        entries: { mode: 'replaceArr', replace: 'Nope', items: 'x' },
      },
    );
    expect(target.entries).toEqual(named('One'));
    expect(warnings).toEqual(['modFailed: entries: no item ""Nope"" in "entries"']);
  });

  it('replaceOrAppendArr appends when nothing matches', () => {
    const { target } = mod(
      { entries: ['a'] },
      {
        entries: { mode: 'replaceOrAppendArr', replace: 'zzz', items: 'b' },
      },
    );
    expect(target.entries).toEqual(['a', 'b']);
  });

  it('removeArr by names (string or list) and by items', () => {
    const { target, warnings } = mod(
      { entries: named('A', 'B', 'C'), tags: ['x', 'y'] },
      {
        entries: [
          { mode: 'removeArr', names: 'A' },
          { mode: 'removeArr', names: ['C', 'Missing'], force: true },
        ],
        tags: { mode: 'removeArr', items: 'x' },
      },
    );
    expect(target.entries).toEqual(named('B'));
    expect(target.tags).toEqual(['y']);
    expect(warnings).toEqual([]);
  });

  it('renameArr renames an item', () => {
    const { target } = mod(
      { entries: named('Old') },
      {
        entries: { mode: 'renameArr', renames: { rename: 'Old', with: 'New' } },
      },
    );
    expect(target.entries).toEqual([{ name: 'New', entries: ['Old text'] }]);
  });

  it('replaceTxt replaces outside tags only, in strings and inside entry bodies', () => {
    const { target } = mod(
      {
        entries: [
          'Goblins hate {@creature Goblins|TST}.',
          {
            type: 'entries',
            name: 'Goblins',
            entries: ['goblins everywhere', { name: 'Goblin Kin', entries: [] }],
          },
        ],
      },
      { entries: { mode: 'replaceTxt', replace: 'goblin', with: 'imp', flags: 'i' } },
    );
    // As in 5etools, a top-level entry's own name is left alone; its body is rewritten.
    expect(target.entries).toEqual([
      'imps hate {@creature Goblins|TST}.',
      {
        type: 'entries',
        name: 'Goblins',
        entries: ['imps everywhere', { name: 'imp Kin', entries: [] }],
      },
    ]);
  });

  it('replaceName only touches names', () => {
    const { target } = mod(
      { entries: [{ name: 'Fire Breath', entries: ['Fire!'] }] },
      {
        entries: { mode: 'replaceName', replace: 'Fire', with: 'Frost' },
      },
    );
    expect(target.entries).toEqual([{ name: 'Frost Breath', entries: ['Fire!'] }]);
  });

  it('setProp with a dotted prop and with `_`', () => {
    const { target } = mod(
      { inherits: { rarity: 'rare' } },
      {
        'inherits.namePrefix': { mode: 'setProp', value: '+2 ' },
        _: { mode: 'setProp', prop: 'speed.fly', value: 30 },
      },
    );
    expect(target).toEqual({ inherits: { rarity: 'rare', namePrefix: '+2 ' }, speed: { fly: 30 } });
  });

  it('"remove" deletes a property', () => {
    const { target } = mod(
      { inherits: { srd: true, rarity: 'rare' } },
      { 'inherits.srd': 'remove' },
    );
    expect(target).toEqual({ inherits: { rarity: 'rare' } });
  });

  it('appendStr and prefixSuffixStringProp', () => {
    const { target } = mod(
      { name: 'Blade', note: 'a' },
      {
        note: { mode: 'appendStr', str: 'b', joiner: '; ' },
        _: { mode: 'prefixSuffixStringProp', prop: 'name', prefix: 'Great ', suffix: '!' },
      },
    );
    expect(target).toEqual({ name: 'Great Blade!', note: 'a; b' });
  });

  it('scalarAddProp and scalarMultProp keep signed strings', () => {
    const { target } = mod(
      { save: { dex: '+2', con: 3 } },
      {
        save: [
          { mode: 'scalarAddProp', prop: '*', scalar: 1 },
          { mode: 'scalarMultProp', prop: 'con', scalar: 1.5, floor: true },
        ],
      },
    );
    expect(target.save).toEqual({ dex: '+3', con: 6 });
  });

  it('reports unsupported modes', () => {
    const { warnings } = mod({}, { _: { mode: 'addSpells' } });
    expect(warnings).toEqual(['modUnsupported: Unsupported _mod mode "addSpells"']);
  });

  it('does not share item objects with the mod', () => {
    const item = { name: 'X', entries: ['a'] };
    const { target } = mod({ entries: [] }, { entries: { mode: 'appendArr', items: item } });
    (target.entries as { entries: string[] }[])[0]?.entries.push('b');
    expect(item.entries).toEqual(['a']);
  });
});
