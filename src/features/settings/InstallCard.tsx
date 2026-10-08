// Install the app (plan §6.9, step 7.2): an "Install" button where the browser offers it (Android,
// desktop Chromium), the Share → Add to Home Screen steps on iOS. Both say why: an installed app
// keeps its data better. On the Characters screen it shows until put away; in Settings, always.

import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import page from '../../app/Page.module.css';
import { promptInstall, useInstallState } from '../../app/install.ts';
import { repos } from '../../db/repos.ts';
import { detectEnv, shouldShowInstallGuide } from '../../db/storage.ts';
import { Button } from '../../ui/Button.tsx';
import { InstallGuide } from './InstallGuide.tsx';

export function InstallCard({ dismissible = false }: { dismissible?: boolean }) {
  const state = useInstallState();
  const env = useMemo(() => detectEnv(), []);
  const dismissed = useLiveQuery(() => repos().settings.get('installCardDismissed'), []);
  if (env.standalone || state === 'installed') return null;
  if (dismissible && dismissed !== false) return null;
  const putAway = dismissible ? (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => void repos().settings.set('installCardDismissed', true)}
    >
      Not now
    </Button>
  ) : null;

  if (shouldShowInstallGuide(env))
    return (
      <div>
        <InstallGuide compact={dismissible} />
        {putAway}
      </div>
    );
  if (state !== 'available') return null;
  return (
    <section className={page.card} aria-labelledby="install-title">
      <h2 id="install-title" className={page.cardTitle}>
        Install the app
      </h2>
      <p className={page.muted}>
        An installed app keeps its data better: browsers clear a website’s storage more readily than
        an app’s. It also opens like any other app, offline.
      </p>
      <div className={page.row}>
        <Button variant="primary" onClick={() => void promptInstall()}>
          Install
        </Button>
        {putAway}
      </div>
    </section>
  );
}
