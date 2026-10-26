// Release settings (plan 9.0): set when the site is built, never edited in code. See
// `.env.example` for what each one does.

export const RELEASE = {
  /** The app's public name (`VITE_APP_NAME`). */
  name: __APP_NAME__,
  version: __APP_VERSION__,
  /** Where takedown and other requests go: an email address or a URL (`VITE_CONTACT`). */
  contact: import.meta.env.VITE_CONTACT?.trim() ?? '',
  /** A "support the project" link, shown in About when set (`VITE_DONATE_URL`). */
  donateUrl: import.meta.env.VITE_DONATE_URL?.trim() ?? '',
  /** The developer screens: in development, or when a build asks for them (`VITE_DEV_TOOLS=1`). */
  devTools: import.meta.env.DEV || import.meta.env.VITE_DEV_TOOLS === '1',
};

/** A contact as a link: `mailto:` for an email address. */
export function contactHref(contact: string): string {
  return contact.includes('@') && !contact.includes('/') ? `mailto:${contact}` : contact;
}
