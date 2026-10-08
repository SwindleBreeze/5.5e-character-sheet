import { describe, expect, it } from 'vitest';
import { summaryOf } from './entityMeta.ts';

describe('summaryOf', () => {
  it('says to press Read when the first sentence leads into a list', () => {
    expect(
      summaryOf([
        'You reach out to the elements, creating one of the following effects:',
        { type: 'list', items: ['One', 'Two'] },
      ]),
    ).toEqual({
      text: 'You reach out to the elements, creating one of the following effects:',
      more: 'Press Read to see them.',
    });
  });

  it('says the text goes on, or nothing when the sentence is all of it', () => {
    expect(summaryOf(['A bolt of light. It sheds light too.']).more).toBe(
      'Press Read for the full text.',
    );
    expect(summaryOf(['A bolt of {@b light}.'])).toEqual({ text: 'A bolt of light.' });
    expect(summaryOf([])).toEqual({ text: '' });
  });
});
