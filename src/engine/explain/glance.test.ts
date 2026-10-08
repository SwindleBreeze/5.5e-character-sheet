import { describe, expect, it } from 'vitest';
import { glance } from './glance.ts';

describe('a feature at a glance', () => {
  it('how it is used, from the first way its own text names', () => {
    expect(
      glance({
        entries: [
          'As a {@variantrule Bonus Action|XPHB}, you can roar. You can leave it early as a Reaction.',
        ],
      }),
    ).toEqual(['{@variantrule Bonus Action|XPHB}']);
    expect(
      glance({ entries: ['When a creature hits you, you can take a Reaction to shrug.'] }),
    ).toEqual(['{@variantrule Reaction|XPHB}']);
    expect(glance({ entries: ['As a Magic action, you glow for 1 minute.'] })).toEqual([
      '{@action Magic|XPHB} action',
      'Lasts 1 minute',
    ]);
  });

  it('uses from its counters, or once per rest from its text', () => {
    const entries = [
      'You can do this. Once you use this feature, you can’t do so again until you finish a Long Rest.',
    ];
    expect(
      glance({ entries: ["You can't use it again until you finish a Short or Long Rest."] }),
    ).toEqual(['Once per {@variantrule Short Rest|XPHB} or {@variantrule Long Rest|XPHB}']);
    expect(
      glance({ entries, resources: [{ name: 'Roar', max: 2, recharge: 'shortOne' }] }),
    ).toEqual([
      '2 uses, one back on a {@variantrule Short Rest|XPHB}, all on a {@variantrule Long Rest|XPHB}',
    ]);
    expect(
      glance({ entries, resources: [{ name: 'Pool', max: 15, recharge: 'long', pool: true }] }),
    ).toEqual(['15 in its pool, back on a {@variantrule Long Rest|XPHB}']);
    // Counters shown next to it already: their uses are left out.
    expect(
      glance({
        entries,
        resources: [{ name: 'Roar', max: 2, recharge: 'long' }],
        countersShown: true,
      }),
    ).toEqual([]);
  });

  it('once per turn, a save it calls for; nothing for plain text, or for features under it', () => {
    expect(
      glance({
        entries: [
          'Once per turn, when you hit, the target must make a Wisdom saving throw against your spell save DC.',
        ],
      }),
    ).toEqual(['Once per turn', 'Wisdom {@variantrule Saving Throw|XPHB|saving throw}']);
    expect(glance({ entries: ['You know a lot about rocks.'] })).toEqual([]);
    expect(
      glance({
        entries: [
          'You gain these.',
          { type: 'refSubclassFeature', subclassFeature: 'x' } as never,
          { type: 'options', entries: ['As a Bonus Action, …'] } as never,
        ],
      }),
    ).toEqual([]);
  });
});
