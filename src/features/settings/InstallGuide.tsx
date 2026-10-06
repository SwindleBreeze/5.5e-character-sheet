import page from '../../app/Page.module.css';

/** iOS guide: installed apps keep their data longer, and have their own storage (plan §6.9). */
export function InstallGuide({ compact = false }: { compact?: boolean }) {
  return (
    <section className={page.card} aria-labelledby="install-guide-title">
      <h2 id="install-guide-title" className={page.cardTitle}>
        Install this app first
      </h2>
      <p className={page.muted}>
        On iPhone and iPad, characters are safest in the installed app. Install it before you import
        content or create characters.
      </p>
      {!compact && (
        <ol>
          <li>Tap the Share button in Safari.</li>
          <li>Choose “Add to Home Screen”.</li>
          <li>Open the app from your Home Screen and import your group’s pack there.</li>
        </ol>
      )}
    </section>
  );
}
