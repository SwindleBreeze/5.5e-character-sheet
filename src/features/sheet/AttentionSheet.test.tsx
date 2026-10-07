import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../db/db.ts';
import { repos } from '../../db/repos.ts';
import type { Character } from '../../schema/index.ts';
import { testCharacter } from '../../test/characters.ts';
import { renderApp } from '../../test/renderApp.tsx';
import { seedFixtureContent } from '../../test/seedContent.ts';
import { SAVE_DELAY_MS } from './useCharacterActions.ts';

const stored = async (id: string) => (await repos().characters.get(id))!;
const saved = () => act(() => new Promise((r) => setTimeout(r, SAVE_DELAY_MS + 50)));

/** Brute 1 with nothing picked yet. */
async function savedBrute(): Promise<Character> {
  const c = testCharacter({ name: 'Grosh', classes: [{ classId: 'brute|tst', levels: 1 }] });
  return repos().characters.save(c, 1);
}

beforeEach(async () => {
  await resetDb('test-attention');
  await seedFixtureContent(['TST']);
});

// Found while the bottom sheet is open too, when the page behind it is hidden.
const chip = () => screen.findByRole('button', { name: /^Needs attention \(\d+\)/, hidden: true });
const countOf = async () => Number(/\((\d+)\)/.exec((await chip()).textContent!)![1]);

describe('Needs attention', () => {
  it('makes a choice that is still to make', async () => {
    const user = userEvent.setup();
    const c = await savedBrute();
    renderApp(`/c/${c.id}/main`);
    await user.click(await chip());
    const sheet = within(await screen.findByRole('dialog', { name: 'Needs attention' }));
    const choices = within(sheet.getByRole('list', { name: 'Choices to make' }));
    const skills = choices.getByText('Brute: Skills').closest('li')!;
    await user.click(within(skills).getByRole('button', { name: 'Choose' }));
    const picker = within(await screen.findByRole('dialog', { name: 'Skills: Brute' }));
    await user.click(await picker.findByRole('checkbox', { name: 'Athletics' }));
    await user.click(picker.getByRole('checkbox', { name: 'Survival' }));
    await user.click(picker.getByRole('button', { name: 'Save' }));
    await saved();
    const record = (await stored(c.id)).log[0]!.choices.find((r) => r.key.slot === 'skills');
    expect(record).toMatchObject({ values: ['athletics', 'survival'], via: 'creation' });
  });

  it('ignores an item until shown again; the chip counts only what isn’t ignored', async () => {
    const user = userEvent.setup();
    const c = await savedBrute();
    renderApp(`/c/${c.id}/main`);
    const before = await countOf();
    await user.click(await chip());
    const sheet = within(await screen.findByRole('dialog', { name: 'Needs attention' }));
    const skills = sheet.getByText('Brute: Skills').closest('li')!;
    await user.click(within(skills).getByRole('button', { name: 'Ignore' }));
    const ignored = within(sheet.getByRole('list', { name: 'Ignored' }));
    expect(ignored.getByText('Brute: Skills')).toBeTruthy();
    expect(await countOf()).toBe(before - 1);
    await saved();
    expect((await stored(c.id)).ui.ignoredAttention).toEqual(['pending:class:brute|tst#skills']);

    await user.click(ignored.getByRole('button', { name: 'Show again' }));
    expect(await countOf()).toBe(before);
  });

  it('stores snapshots of the content in use when the sheet opens', async () => {
    const c = await savedBrute();
    renderApp(`/c/${c.id}/main`);
    await chip();
    await saved();
    const snapshots = (await stored(c.id)).snapshots;
    expect(snapshots['class:brute|tst']?.name).toBe('Brute');
    expect(snapshots['classFeature:fury|brute|tst|1|tst']?.name).toBe('Fury');
  });
});
