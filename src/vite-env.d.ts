/// <reference types="vite/client" />

/** App version from package.json, injected by vite.config.ts. */
declare const __APP_VERSION__: string;

/** The app's public name (`VITE_APP_NAME`), injected by vite.config.ts. */
declare const __APP_NAME__: string;

interface ImportMetaEnv {
  /** Where takedown and other requests go: an email address or a URL (plan 9.6). */
  readonly VITE_CONTACT?: string;
  /** A "support the project" link, shown in About when set (plan 9.7). */
  readonly VITE_DONATE_URL?: string;
  /** `1` keeps the developer screens in a production build. */
  readonly VITE_DEV_TOOLS?: string;
}
