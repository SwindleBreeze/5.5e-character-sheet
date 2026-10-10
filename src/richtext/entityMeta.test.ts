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
    const long = 'It goes on. '.repeat(30).trim();
    expect(summaryOf(['A bolt of light.', long]).more).toBe('Press Read for the full text.');
    expect(summaryOf(['A bolt of {@b light}.'])).toEqual({ text: 'A bolt of light.' });
    expect(summaryOf([])).toEqual({ text: '' });
  });

  it('shows short text whole, without sending the reader to Read', () => {
    expect(summaryOf(['You touch a creature. Its {@b Speed} rises.'])).toEqual({
      text: 'You touch a creature. Its Speed rises.',
    });
    expect(summaryOf(['One line.', 'Another line.'])).toEqual({ text: 'One line. Another line.' });
  });
});
