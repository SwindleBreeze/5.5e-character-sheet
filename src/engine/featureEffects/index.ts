// The app's feature mappings. Core mapping modules (plan §9.3 step 4.2, §9.4 step 5.8, phase
// 6) are imported here so they register before anything reads `featureEffects()`.

export { featureEffects, registerFeatureEffects } from './registry.ts';
