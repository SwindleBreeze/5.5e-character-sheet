import { useMemo } from 'react';
import { Link } from 'react-router';
import { TopBar } from '../../app/TopBar.tsx';
import page from '../../app/Page.module.css';
import { useTheme } from '../../app/theme/useTheme.ts';
import type { ThemePref } from '../../app/theme/theme.ts';
import { detectEnv, shouldShowInstallGuide } from '../../db/storage.ts';
import { SourceToggles } from '../sources/SourceToggles.tsx';
import { BackupCard } from './BackupCard.tsx';
import { InstallGuide } from './InstallGuide.tsx';
import { StorageCard } from './StorageCard.tsx';
import styles from './SettingsPage.module.css';

const THEMES: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function SettingsPage() {
  const [theme, setTheme] = useTheme();
  const showInstallGuide = useMemo(() => shouldShowInstallGuide(detectEnv()), []);

  return (
    <>
      <TopBar title="Settings" />
      <div className={page.content}>
        <section className={page.card} aria-labelledby="theme-title">
          <h2 id="theme-title" className={page.cardTitle}>
            Theme
          </h2>
          <div className={styles.segmented} role="radiogroup" aria-labelledby="theme-title">
            {THEMES.map((t) => (
              <label key={t.value} className={styles.segment}>
                <input
                  type="radio"
                  name="theme"
                  value={t.value}
                  checked={theme === t.value}
                  onChange={() => setTheme(t.value)}
                />
                <span>{t.label}</span>
              </label>
            ))}
          </div>
        </section>

        <section className={page.card} aria-labelledby="sources-title">
          <h2 id="sources-title" className={page.cardTitle}>
            Sources
          </h2>
          <p className={page.muted}>
            Choose which imported books the library and character builder offer. 2014 books are
            listed but can’t be switched on yet.
          </p>
          <SourceToggles />
          <p>
            <Link to="/library/import">Import or share content</Link>
          </p>
        </section>

        {showInstallGuide && <InstallGuide />}
        <BackupCard />
        <StorageCard />

        <section className={page.card} aria-labelledby="about-title">
          <h2 id="about-title" className={page.cardTitle}>
            About
          </h2>
          <p className={page.muted}>
            Version {__APP_VERSION__}. This app ships no game content. Import your group’s pack to
            get started.
          </p>
        </section>
      </div>
    </>
  );
}
