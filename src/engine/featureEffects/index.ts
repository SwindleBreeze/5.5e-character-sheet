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
import { WARLOCK } from './core/warlock.ts';
import { WIZARD } from './core/wizard.ts';
import { FEATS } from './core/feats.ts';
import { SPECIES } from './core/species.ts';
import { SUP_ARTIFICER } from './supplements/artificer.ts';
import { SUP_ARTIFICER_SUBCLASSES } from './supplements/artificerSubclasses.ts';
import { SUP_BARD } from './supplements/bard.ts';
import { SUP_CLERIC } from './supplements/cleric.ts';
import { SUP_FIGHTER } from './supplements/fighter.ts';
import { SUP_MONK } from './supplements/monk.ts';
import { SUP_PALADIN } from './supplements/paladin.ts';
import { SUP_RANGER } from './supplements/ranger.ts';
import { SUP_ROGUE } from './supplements/rogue.ts';
import { SUP_SORCERER } from './supplements/sorcerer.ts';
import { SUP_WARLOCK } from './supplements/warlock.ts';
import { SUP_WIZARD } from './supplements/wizard.ts';
import { SUP_FEATS } from './supplements/feats.ts';
import { SUP_SPECIES } from './supplements/species.ts';
import { LEGACY_CLERIC } from './legacy/cleric.ts';
import { ITEMS_A_TO_C } from './items/itemsAtoC.ts';
import { ITEMS_D_TO_H } from './items/itemsDtoH.ts';
import { ITEMS_I_TO_Q } from './items/itemsItoQ.ts';
import { ITEMS_R_TO_Z } from './items/itemsRtoZ.ts';
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
registerFeatureEffects(WARLOCK);
registerFeatureEffects(WIZARD);
registerFeatureEffects(FEATS);
registerFeatureEffects(SPECIES);
// The 2024 supplements (Eberron: Forge of the Artificer, Heroes of Faerûn, and the others).
registerFeatureEffects(SUP_ARTIFICER);
registerFeatureEffects(SUP_ARTIFICER_SUBCLASSES);
registerFeatureEffects(SUP_BARD);
registerFeatureEffects(SUP_CLERIC);
registerFeatureEffects(SUP_FIGHTER);
registerFeatureEffects(SUP_MONK);
registerFeatureEffects(SUP_PALADIN);
registerFeatureEffects(SUP_RANGER);
registerFeatureEffects(SUP_ROGUE);
registerFeatureEffects(SUP_SORCERER);
registerFeatureEffects(SUP_WARLOCK);
registerFeatureEffects(SUP_WIZARD);
registerFeatureEffects(SUP_FEATS);
registerFeatureEffects(SUP_SPECIES);
// 2014 options on 2024 characters (step 8.3).
registerFeatureEffects(LEGACY_CLERIC);
// The 2024 Dungeon Master's Guide's magic items (step 7.12).
registerFeatureEffects(ITEMS_A_TO_C);
registerFeatureEffects(ITEMS_D_TO_H);
registerFeatureEffects(ITEMS_I_TO_Q);
registerFeatureEffects(ITEMS_R_TO_Z);

export { featureEffects, registerFeatureEffects } from './registry.ts';
