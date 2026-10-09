// Content imported by an older version of the app (plan step 7.1): what a re-import would add,
// and where to do it. Homebrew is left alone (it is imported from its own files).

import { Link } from 'react-router';
import page from '../../app/Page.module.css';
import { ADAPTER_VERSION, changesSince } from '../../adapters/version.ts';
import { useSources } from '../../content/hooks.ts';

export function StaleContentNotice() {
  const sources = useSources();
  const stale = (sources ?? []).filter(
    (s) => s.origin !== 'homebrew' && s.adapterVersion < ADAPTER_VERSION,
  );
  if (!stale.length) return null;
  const oldest = Math.min(...stale.map((s) => s.adapterVersion));
  const changes = changesSince(oldest);
  return (
    <section className={page.card} aria-labelledby="stale-content-title">
      <h2 id="stale-content-title" className={page.cardTitle}>
        Re-import your content
      </h2>
      <p>
        {stale.length === 1 ? 'One book was' : `${stale.length} books were`} imported by an older
        version of the app
        {changes.length ? `; importing again adds ${changes.join(', ')}` : ''}. Your characters stay
        as they are.
      </p>
      <p className={page.muted}>
        Use the 5etools files, or a pack made with this version of the app.
      </p>
      <p>
        <Link to="/library/import">Import content</Link>
      </p>
    </section>
  );
}
