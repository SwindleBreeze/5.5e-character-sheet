// The app's feature mappings. Core mapping modules (plan §9.3 step 4.2, §9.4 step 5.8, phase
// 6) are imported here so they register before anything reads `featureEffects()`.

import { CORE_LEVELS_1_TO_3 } from './core/levels1to3.ts';
import { CORE_LEVELS_4_TO_20 } from './core/levels4to20.ts';
import { BARBARIAN } from './core/barbarian.ts';
import { BARD } from './core/bard.ts';
import { CLERIC } from './core/cleric.ts';
import { DRUID } from './core/druid.ts';
import { FIGHTER } from './core/fighter.ts';
import { MONK } from './core/monk.ts';
import { PALADIN } from './core/paladin.ts';
import { RANGER } from './core/ranger.ts';
import { ROGUE } from './core/rogue.ts';
import { SORCERER } from './core/sorcerer.ts';
import { registerFeatureEffects } from './registry.ts';

registerFeatureEffects(CORE_LEVELS_1_TO_3);
registerFeatureEffects(CORE_LEVELS_4_TO_20);
registerFeatureEffects(BARBARIAN);
registerFeatureEffects(BARD);
registerFeatureEffects(CLERIC);
registerFeatureEffects(DRUID);
registerFeatureEffects(FIGHTER);
registerFeatureEffects(MONK);
registerFeatureEffects(PALADIN);
registerFeatureEffects(RANGER);
registerFeatureEffects(ROGUE);
registerFeatureEffects(SORCERER);

export { featureEffects, registerFeatureEffects } from './registry.ts';
