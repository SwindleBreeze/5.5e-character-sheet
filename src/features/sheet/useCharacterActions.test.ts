import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { newCharacter } from '../../db/characterRepo.ts';
import { resetDb } from '../../db/db.ts';
import { repos } from '../../db/repos.ts';
import { setExhaustion, setHeroicInspiration } from '../../engine/play/reducers.ts';
import type { Character } from '../../schema/index.ts';
import { SAVE_DELAY_MS, useCharacterActions } from './useCharacterActions.ts';

let stored: Character;

beforeEach(async () => {
  await resetDb('test-character-actions');
  stored = await repos().characters.save(newCharacter('Ada', 1), 1);
});

describe('useCharacterActions', () => {
  it('shows a change at once and writes several changes as one save', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const save = vi.spyOn(repos().characters, 'save');
    const { result } = renderHook(() => useCharacterActions(stored));

    act(() => result.current.apply((c) => setHeroicInspiration(c, true)));
    act(() => result.current.apply((c) => setExhaustion(c, 2)));
    expect(result.current.character?.state).toMatchObject({
      heroicInspiration: true,
      exhaustion: 2,
    });
    expect(save).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SAVE_DELAY_MS);
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[0].state).toMatchObject({ heroicInspiration: true, exhaustion: 2 });
    vi.useRealTimers();
  });

  it('a change that changes nothing is not saved', () => {
    const save = vi.spyOn(repos().characters, 'save');
    const { result } = renderHook(() => useCharacterActions(stored));
    act(() => result.current.apply((c) => c));
    expect(result.current.character).toBe(stored);
    expect(save).not.toHaveBeenCalled();
  });

  it('writes a pending change when the sheet closes', async () => {
    const { result, unmount } = renderHook(() => useCharacterActions(stored));
    act(() => result.current.apply((c) => setExhaustion(c, 3)));
    unmount();
    await vi.waitFor(async () =>
      expect((await repos().characters.get(stored.id))?.state.exhaustion).toBe(3),
    );
  });

  it('the stored copy takes over once it is newer', async () => {
    const { result, rerender } = renderHook(({ c }) => useCharacterActions(c), {
      initialProps: { c: stored },
    });
    act(() => result.current.apply((c) => setExhaustion(c, 1)));
    await act(() => result.current.flush());
    // Saved elsewhere later (another tab): the newer stored copy is shown.
    const elsewhere = { ...stored, updatedAt: Date.now() + 10_000, name: 'Bea' };
    rerender({ c: elsewhere });
    expect(result.current.character?.name).toBe('Bea');
  });
});
