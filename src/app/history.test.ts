import { describe, expect, it } from 'vitest';
import { planBack, sameScreen } from './history.ts';

describe('sameScreen', () => {
  it('counts a sheet with another tab open as the sheet, but not its level-up', () => {
    expect(sameScreen('/c/a/spells', '/c/a/main')).toBe(true);
    expect(sameScreen('/c/a', '/c/a/main')).toBe(true);
    expect(sameScreen('/c/a/level-up', '/c/a/main')).toBe(false);
    expect(sameScreen('/c/b/main', '/c/a/main')).toBe(false);
    expect(sameScreen('/', '/')).toBe(true);
    expect(sameScreen('/library', '/')).toBe(false);
  });
});

describe('planBack', () => {
  it('goes back when the screen before is the one to go to', () => {
    expect(planBack('/', undefined, 1, { 0: '/', 1: '/c/a/main' })).toEqual({
      back: 1,
      replace: false,
    });
  });

  it('leaves every step of a wizard together', () => {
    const record = { 0: '/', 1: '/new/a/class', 2: '/new/a/background', 3: '/new/a/species' };
    expect(planBack('/', '/new/a/', 3, record)).toEqual({ back: 3, replace: false });
  });

  it('puts the sheet in place of the first step when a wizard is finished', () => {
    const record = { 0: '/', 1: '/new/a/class', 2: '/new/a/review' };
    expect(planBack('/c/a/main', '/new/a/', 2, record)).toEqual({ back: 1, replace: true });
  });

  it('goes back to the sheet tab a level-up was opened from', () => {
    const record = { 0: '/', 1: '/c/a/spells', 2: '/c/a/level-up' };
    expect(planBack('/c/a/main', '/c/a/level-up', 2, record)).toEqual({
      back: 1,
      replace: false,
    });
  });

  it('replaces the entry when the screen before is unknown or another one', () => {
    expect(planBack('/', undefined, 0, { 0: '/c/a/main' })).toEqual({ back: 0, replace: true });
    expect(planBack('/', undefined, 3, { 3: '/c/a/main' })).toEqual({ back: 0, replace: true });
    expect(planBack('/', undefined, 1, { 0: '/dev/build', 1: '/c/a/main' })).toEqual({
      back: 0,
      replace: true,
    });
    expect(planBack('/', undefined, null)).toEqual({ back: 0, replace: true });
  });
});
