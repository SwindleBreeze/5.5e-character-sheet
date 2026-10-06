import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../db/db.ts';
import { repos } from '../../db/repos.ts';
import { createCatalog } from '../../engine/build/catalog.ts';
import { quickBuild } from '../../engine/build/quickBuild.ts';
import type { ContentEntity } from '../../schema/index.ts';
import { fixtureContent } from '../../test/fixtureIndex.ts';
import { renderApp } from '../../test/renderApp.tsx';
import { seedFixtureContent } from '../../test/seedContent.ts';

beforeEach(async () => {
  await resetDb('test-gallery');
});

const frames = () => screen.getAllByRole('region', { name: /^(A|B) · .+, (light|dark)$/ });

describe('DesignGallery', () => {
  it('shows every direction in light and dark, and filters them', async () => {
    const user = userEvent.setup();
    renderApp('/dev/design');
    await screen.findByRole('heading', { level: 1, name: 'Design gallery' });
    expect(frames().map((f) => [f.dataset.dir, f.dataset.scheme])).toEqual([
      ['a', 'light'],
      ['a', 'dark'],
      ['b', 'light'],
      ['b', 'dark'],
    ]);
    // Every frame has the sheet components, with sample numbers.
    for (const frame of frames()) {
      expect(within(frame).getByRole('group', { name: 'Strength' })).toBeInTheDocument();
      expect(within(frame).getAllByRole('button', { name: /^Hit points 31 of 44/ })).toHaveLength(
        2,
      );
    }
    await user.click(screen.getByRole('checkbox', { name: 'Dark' }));
    await user.click(screen.getByRole('checkbox', { name: 'A · Parchment' }));
    expect(frames().map((f) => [f.dataset.dir, f.dataset.scheme])).toEqual([['b', 'light']]);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Width' }), 'tablet');
    expect(frames()[0]).toHaveStyle({ width: '768px' });
  });

  it('frames share one sample state: a change in one shows in all', async () => {
    const user = userEvent.setup();
    renderApp('/dev/design');
    const [first] = await screen.findAllByRole('region', { name: /, light$/ });
    await user.click(within(first!).getByRole('button', { name: /Inspiration/ }));
    for (const frame of frames()) {
      expect(within(frame).getByRole('button', { name: /Inspiration/ })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    }
  });

  it('picks the direction for the whole app', async () => {
    const user = userEvent.setup();
    renderApp('/dev/design');
    await user.click(await screen.findByRole('radio', { name: /B · Slate/ }));
    expect(document.documentElement.dataset.dir).toBe('b');
  });

  it("shows a saved character's Main tab in every frame", async () => {
    const user = userEvent.setup();
    await seedFixtureContent(['TST']);
    const { index, entities } = await fixtureContent();
    const catalog = createCatalog(
      Object.values(entities).flat() as ContentEntity[],
      new Set(['TST']),
    );
    await repos().characters.save(
      quickBuild(
        { name: 'Grosh', classes: [{ classId: 'brute|tst', levels: 2 }] },
        { index, catalog, now: 1 },
      ),
    );
    renderApp('/dev/design');
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Show' }), 'main');
    for (const frame of await screen.findAllByRole('region', { name: /, (light|dark)$/ })) {
      expect(
        await within(frame).findByRole('region', { name: 'Saving throws' }),
      ).toBeInTheDocument();
    }
  });
});
