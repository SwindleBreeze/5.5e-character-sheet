import { describe, expect, it } from 'vitest';
import { alignmentRecords } from './manifest.ts';

describe('alignments from the book text', () => {
  it('reads the sections headed with an alignment and its code, once each', () => {
    const book = {
      data: [
        {
          type: 'section',
          name: 'Chapter',
          entries: [
            { type: 'entries', name: 'Lawful Good (LG)', page: 9, entries: ['First text.'] },
            { type: 'entries', name: 'Neutral (N)', entries: ['Second text.'] },
            { type: 'entries', name: 'Lawful Good (LG)', entries: ['A repeat.'] },
            { type: 'entries', name: 'Good Things (GT)', entries: ['Not one.'] },
          ],
        },
      ],
    };
    expect(alignmentRecords(book)).toEqual([
      {
        name: 'Lawful Good',
        source: 'XPHB',
        page: 9,
        abbreviation: 'LG',
        entries: ['First text.'],
      },
      { name: 'Neutral', source: 'XPHB', abbreviation: 'N', entries: ['Second text.'] },
    ]);
  });
});
