import { describe, expect, it, vi } from 'vitest';
import {
  detectEnv,
  formatBytes,
  getStorageStatus,
  looksEvicted,
  requestPersistenceIfUseful,
  shouldShowInstallGuide,
} from './storage.ts';

const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15';
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140';

const media = (matches: boolean) => ({ matchMedia: () => ({ matches }) });

describe('detectEnv', () => {
  it('detects iPhone in a Safari tab', () => {
    const env = detectEnv({ userAgent: IPHONE_UA }, media(false));
    expect(env).toEqual({ ios: true, standalone: false, persistSupported: false });
    expect(shouldShowInstallGuide(env)).toBe(true);
  });

  it('detects iPadOS reporting as a Mac, and installed mode', () => {
    const env = detectEnv(
      {
        userAgent: 'Mozilla/5.0 (Macintosh)',
        platform: 'MacIntel',
        maxTouchPoints: 5,
        standalone: true,
      },
      media(false),
    );
    expect(env.ios).toBe(true);
    expect(env.standalone).toBe(true);
    expect(shouldShowInstallGuide(env)).toBe(false);
  });

  it('treats desktop browsers as non-iOS', () => {
    const env = detectEnv(
      { userAgent: DESKTOP_UA, storage: { persist: async () => true } },
      media(true),
    );
    expect(env).toEqual({ ios: false, standalone: true, persistSupported: true });
    expect(shouldShowInstallGuide(env)).toBe(false);
  });
});

describe('requestPersistenceIfUseful', () => {
  const env = { ios: false, standalone: false, persistSupported: true };

  it('does not ask before install or a first saved character', async () => {
    const persist = vi.fn(async () => true);
    const nav = { userAgent: DESKTOP_UA, storage: { persist, persisted: async () => false } };
    expect(await requestPersistenceIfUseful(env, { hasSavedCharacter: false }, nav)).toBe(false);
    expect(persist).not.toHaveBeenCalled();
  });

  it('asks once a character is saved, and reports the result', async () => {
    const persist = vi.fn(async () => true);
    const nav = { userAgent: DESKTOP_UA, storage: { persist, persisted: async () => false } };
    expect(await requestPersistenceIfUseful(env, { hasSavedCharacter: true }, nav)).toBe(true);
    expect(persist).toHaveBeenCalledOnce();
  });

  it('asks when installed, and skips the request when already persisted', async () => {
    const persist = vi.fn(async () => true);
    const installed = { ...env, standalone: true };
    const nav = { userAgent: DESKTOP_UA, storage: { persist, persisted: async () => true } };
    expect(await requestPersistenceIfUseful(installed, { hasSavedCharacter: false }, nav)).toBe(
      true,
    );
    expect(persist).not.toHaveBeenCalled();
  });

  it('returns null when the Storage API is missing', async () => {
    const noApi = { ios: true, standalone: true, persistSupported: false };
    expect(
      await requestPersistenceIfUseful(
        noApi,
        { hasSavedCharacter: true },
        { userAgent: IPHONE_UA },
      ),
    ).toBeNull();
  });
});

describe('getStorageStatus', () => {
  it('reports usage, quota and persistence', async () => {
    const status = await getStorageStatus(
      {
        userAgent: DESKTOP_UA,
        storage: {
          persist: async () => true,
          persisted: async () => true,
          estimate: async () => ({ usage: 2048, quota: 1024 * 1024 }),
        },
      },
      media(false),
    );
    expect(status).toMatchObject({ persisted: true, usageBytes: 2048, quotaBytes: 1048576 });
  });

  it('degrades to unknown when the API throws', async () => {
    const status = await getStorageStatus(
      {
        userAgent: DESKTOP_UA,
        storage: {
          persisted: async () => {
            throw new Error('private mode');
          },
        },
      },
      media(false),
    );
    expect(status.persisted).toBeNull();
    expect(status.usageBytes).toBeNull();
  });
});

describe('formatBytes', () => {
  it('formats sizes', () => {
    expect(formatBytes(null)).toBe('unknown');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(10.5 * 1024 * 1024)).toBe('11 MB');
  });
});

describe('eviction (plan step 7.1)', () => {
  it('is an empty database where the second store remembers characters', () => {
    expect(looksEvicted(0, 3)).toBe(true);
    expect(looksEvicted(0, 0)).toBe(false);
    expect(looksEvicted(2, 3)).toBe(false);
  });
});
