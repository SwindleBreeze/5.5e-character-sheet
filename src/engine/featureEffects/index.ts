// The app's feature mappings. Core mapping modules (plan §9.3 step 4.2, §9.4 step 5.8, phase
// 6) are imported here so they register before anything reads `featureEffects()`.

import { CORE_LEVELS_1_TO_3 } from './core/levels1to3.ts';
import { CORE_LEVELS_4_TO_20 } from './core/levels4to20.ts';
import { registerFeatureEffects } from './registry.ts';

registerFeatureEffects(CORE_LEVELS_1_TO_3);
registerFeatureEffects(CORE_LEVELS_4_TO_20);

export { featureEffects, registerFeatureEffects } from './registry.ts';
