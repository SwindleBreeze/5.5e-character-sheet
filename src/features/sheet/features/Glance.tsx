// A feature at a glance (plan §10.2, step 6.2): how it is used, its uses, a save it calls for
// and how long it lasts, generated from its text's structure. Nothing when its text says none.

import { glance, type GlanceResource } from '../../../engine/explain/glance.ts';
import { InlineText } from '../../../richtext/InlineText.tsx';
import type { Entry } from '../../../schema/index.ts';
import styles from './features.module.css';

export function Glance({
  entries,
  resources,
  countersShown,
}: {
  entries: readonly Entry[];
  resources?: readonly GlanceResource[];
  countersShown?: boolean;
}) {
  const parts = glance({
    entries,
    ...(resources ? { resources } : {}),
    ...(countersShown ? { countersShown } : {}),
  });
  if (!parts.length) return null;
  return (
    <p className={styles.glance} data-kind="glance">
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && ' · '}
          <InlineText text={p} />
        </span>
      ))}
    </p>
  );
}
