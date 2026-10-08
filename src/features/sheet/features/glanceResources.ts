// A derived feature's counters, in the shape the glance line takes (plan §10.2, step 6.2).

import type { DerivedFeature, DerivedSheet } from '../../../engine/derive/types.ts';
import type { GlanceResource } from '../../../engine/explain/glance.ts';

/** A derived feature's counters, for its glance line. */
export function glanceResources(
  feature: DerivedFeature | undefined,
  sheet: DerivedSheet,
): GlanceResource[] {
  return (feature?.resourceKeys ?? [])
    .map((k) => sheet.resources.find((r) => r.key === k))
    .filter((r) => r !== undefined)
    .map((r) => ({ name: r.name, max: r.max.value, recharge: r.recharge, pool: r.pool }));
}
