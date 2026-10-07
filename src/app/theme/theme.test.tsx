import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { THEME_STORAGE_KEY, applyThemePref, readThemePref } from './theme.ts';
import { useTheme } from './useTheme.ts';

describe('theme', () => {
  it('defaults to system and ignores unknown stored values', () => {
    expect(readThemePref()).toBe('system');
    localStorage.setItem(THEME_STORAGE_KEY, 'purple');
    expect(readThemePref()).toBe('system');
  });

  it('applies data-theme only for explicit choices, and always the scheme in effect', () => {
    applyThemePref('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.dataset.scheme).toBe('dark');
    applyThemePref('system');
    expect(document.documentElement.dataset.theme).toBeUndefined();
    // The test environment's system preference is light.
    expect(document.documentElement.dataset.scheme).toBe('light');
  });

  it('switches theme, saves the choice, and clears it for system', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current[0]).toBe('system');

    act(() => result.current[1]('light'));
    expect(result.current[0]).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

    act(() => result.current[1]('dark'));
    expect(document.documentElement.dataset.theme).toBe('dark');

    act(() => result.current[1]('system'));
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('starts from the saved choice', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const { result } = renderHook(() => useTheme());
    expect(result.current[0]).toBe('dark');
  });
});
