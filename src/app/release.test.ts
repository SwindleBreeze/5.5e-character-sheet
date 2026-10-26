import { describe, expect, it } from 'vitest';
import { contactHref, RELEASE } from './release.ts';

describe('release settings', () => {
  it('names the app and keeps the developer screens in development', () => {
    expect(RELEASE.name).toBeTruthy();
    expect(RELEASE.devTools).toBe(true);
  });

  it('links a contact: an email address by mail, anything else as given', () => {
    expect(contactHref('sheet@example.com')).toBe('mailto:sheet@example.com');
    expect(contactHref('https://example.com/contact')).toBe('https://example.com/contact');
  });
});
