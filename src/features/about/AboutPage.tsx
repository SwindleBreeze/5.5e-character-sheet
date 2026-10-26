// About and legal (plan 9.6): what the app is, whose the rules and trademarks are, the free
// rules' attribution, what happens to imported content and to your data, the code licence, and
// where to send requests. Release settings fill in the name, contact and donation link (9.0).

import { TopBar } from '../../app/TopBar.tsx';
import page from '../../app/Page.module.css';
import { contactHref, RELEASE } from '../../app/release.ts';
import { SRD_ATTRIBUTION, SRD_BUNDLED } from '../../content/srd.ts';

export function AboutPage() {
  return (
    <>
      <TopBar title="About" backTo="/settings" />
      <div className={page.content}>
        <section className={page.card} aria-labelledby="about-app">
          <h2 id="about-app" className={page.cardTitle}>
            {RELEASE.name}
          </h2>
          <p className={page.muted}>Version {RELEASE.version}</p>
          <p>
            A free character builder and sheet for the fifth edition rules (2024), for phones and
            computers, that works offline.
            {SRD_BUNDLED
              ? ' It comes with the free rules, the System Reference Document 5.2, and imports content you provide.'
              : ' It imports the content you provide.'}
          </p>
          {RELEASE.donateUrl && (
            <p>
              <a href={RELEASE.donateUrl} target="_blank" rel="noreferrer">
                Support the work on the app
              </a>
              . The app stays free either way: nothing is paid for or held back.
            </p>
          )}
        </section>

        <section className={page.card} aria-labelledby="about-legal">
          <h2 id="about-legal" className={page.cardTitle}>
            Legal
          </h2>
          <p>
            This app is not affiliated with, endorsed, sponsored or approved by Wizards of the
            Coast. Dungeons &amp; Dragons, D&amp;D and their logos are trademarks of Wizards of the
            Coast LLC. Other trademarks belong to their owners.
          </p>
          {SRD_BUNDLED && <p>{SRD_ATTRIBUTION}</p>}
          <p>
            Content you import is your own responsibility: import only what you own or have the
            right to use. It is stored in this browser on this device and is never uploaded.
          </p>
          <p>The app’s code is released under the MIT licence.</p>
          {RELEASE.contact && (
            <p>
              Questions and takedown requests:{' '}
              <a href={contactHref(RELEASE.contact)}>{RELEASE.contact}</a>
            </p>
          )}
        </section>

        <section className={page.card} aria-labelledby="about-privacy">
          <h2 id="about-privacy" className={page.cardTitle}>
            Privacy
          </h2>
          <p>
            No accounts, no ads, no tracking. Your characters and content stay in this browser on
            this device, and nothing is sent anywhere. The app only goes online to update itself and
            to open homebrew links you give it. Backups are files you save yourself.
          </p>
        </section>
      </div>
    </>
  );
}
