// Homebrew casters (plan step 7.4): a class the app has no policy for prepares its spells, its
// list can borrow another class's and add single spells, and older table names give its counts.

import { beforeAll, describe, expect, it } from 'vitest';
import type { ClassDef, ContentEntity, Spell } from '../../schema/index.ts';
import { homebrewContent } from '../../test/homebrewFixture.ts';
import { createCatalog } from '../build/catalog.ts';
import { quickBuild } from '../build/quickBuild.ts';
import type { ContentIndex } from '../content/contentIndex.ts';
import { derive } from '../derive/derive.ts';
import { cantripCount, casterList, preparedCount } from './casters.ts';
import { matchesSpellFilter } from './filter.ts';

let index: ContentIndex;
let all: ContentEntity[];

beforeAll(async () => {
  ({ index, all } = await homebrewContent());
});

const spell = (id: string) => index.get({ kind: 'spell', id }) as Spell;
const hearthwarden = () => index.get({ kind: 'class', id: 'hearthwarden|hearthguide' }) as ClassDef;

describe('homebrew casters', () => {
  it('a borrowed list and single spells: one `list=` filter', () => {
    const cls = hearthwarden();
    const list = casterList(cls);
    expect(list).toBe('list=class:Hearthwarden;class:Lorekeeper;spell:spark bolt@tst');
    // Its own spells, the Lorekeeper's, and the one named; not the Pactbinder's.
    expect(matchesSpellFilter(spell('cinder flick|hearthguide'), list)).toBe(true);
    expect(matchesSpellFilter(spell('rolling boom|tst'), list)).toBe(true);
    expect(matchesSpellFilter(spell('spark bolt|tst'), list)).toBe(true);
    expect(matchesSpellFilter(spell('hex mark|tst'), list)).toBe(false);
    expect(matchesSpellFilter(spell('spark bolt|tst'), `level=1|${list}`)).toBe(false);
  });

  it('counts come from a "Spells Known" column when there is no prepared column', () => {
    const cls = hearthwarden();
    expect(preparedCount(cls.spellcasting!, cls, 1)).toBe(3);
    expect(preparedCount(cls.spellcasting!, cls, 4)).toBe(6);
    expect(cantripCount(cls.spellcasting!, cls, 4)).toBe(3);
  });

  it('a level 3 character prepares from its list, with the subclass spell added', () => {
    const catalog = createCatalog(all, new Set(['TST', 'HearthGuide']));
    const c = quickBuild(
      {
        name: 'Wren',
        classes: [
          {
            classId: 'hearthwarden|hearthguide',
            levels: 3,
            subclassId: 'embers|hearthwarden|hearthguide|hearthguide',
          },
        ],
        speciesId: 'fernling|hearthguide',
        backgroundId: 'lamplighter|hearthguide',
      },
      { index, catalog, now: 1 },
    );
    const sheet = derive(c, index);
    const caster = sheet.spellcasting.casters.find((x) => x.key === 'hearthwarden|hearthguide');
    // No caster policy in the data: prepared after a Long Rest (plan §9.1).
    expect(caster).toMatchObject({ ability: 'wis', preparedChange: 'restLong', maxSpellLevel: 2 });
    expect(caster?.preparedMax).toBe(5);
    expect(caster?.cantrips).toHaveLength(2);
    expect(caster?.list.ids).toContain('warm hearth|hearthguide');
    expect(sheet.issues.filter((i) => i.code === 'overPrepared')).toEqual([]);
  });
});
