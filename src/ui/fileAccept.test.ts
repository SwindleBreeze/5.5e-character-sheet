import { describe, expect, it } from 'vitest';
import { fileAccept } from './fileAccept.ts';

const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1';

describe('fileAccept', () => {
  it('gives Android a single non-media type, so Chrome opens Files without the camera', () => {
    expect(fileAccept('.gz,.json,application/gzip,application/json', ANDROID)).toBe(
      'application/*',
    );
  });

  it('keeps the precise list elsewhere', () => {
    expect(fileAccept('.gz,application/gzip', IPHONE)).toBe('.gz,application/gzip');
  });
});
