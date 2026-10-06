import { importFivetools } from '../adapters/fivetools/index.ts';
import { repos } from '../db/repos.ts';
import { fixtureSource } from './fivetoolsFixture.ts';

/** Import the hand-written fixture into the app database and enable its sources. */
export async function seedFixtureContent(enabled: string[] = ['TST', 'OLD']) {
  const result = await importFivetools(fixtureSource(), { now: 1 });
  await repos().content.replaceSources(result.sources, result.entities);
  await repos().settings.set('enabledSources', enabled);
  return result;
}
