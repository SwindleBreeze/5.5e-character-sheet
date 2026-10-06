// The design gallery (plan §9.2, steps 3.13–3.16): both candidate directions, in light and
// dark, side by side at phone, tablet or desktop width. Shows the tokens and every sheet
// component with sample numbers, or a saved character's Main tab. The design gate is decided
// here: pick a direction for the whole app and try it on your own devices.

import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState, type ReactNode } from 'react';
import { TopBar } from '../../app/TopBar.tsx';
import page from '../../app/Page.module.css';
import { DIRECTIONS, type Direction, type Scheme } from '../../app/theme/theme.ts';
import { useDirection } from '../../app/theme/useTheme.ts';
import { useConditionOptions, useContentIndex } from '../../content/hooks.ts';
import { repos } from '../../db/repos.ts';
import { derive } from '../../engine/derive/derive.ts';
import { featureEffects } from '../../engine/featureEffects/index.ts';
import { ABILITY_NAMES, type Character } from '../../schema/index.ts';
import { Badge } from '../../ui/Badge.tsx';
import { Button } from '../../ui/Button.tsx';
import { Counter } from '../../ui/Counter.tsx';
import { useSheet } from '../../ui/sheetContext.ts';
import { ContributionSheet } from '../sheet/components/ContributionSheet.tsx';
import {
  ContentMissingBadge,
  OverrideMarker,
  ProficiencyMarker,
  SourceBadge,
} from '../sheet/components/markers.tsx';
import { RollButton } from '../sheet/components/RollButton.tsx';
import { AbilityCard, RollRow, SectionHeader, StatPill } from '../sheet/components/stats.tsx';
import { useExplain } from '../sheet/components/useExplain.tsx';
import {
  ConditionChips,
  DeathSaves,
  ExhaustionStepper,
  HitDice,
  HpPill,
  HpWidget,
  NeedsAttentionChip,
} from '../sheet/components/vitals.tsx';
import { MainTab } from '../sheet/MainTab.tsx';
import type { CharacterUpdate } from '../sheet/useCharacterActions.ts';
import {
  DAMAGE_TYPES,
  derived,
  modOf,
  SAMPLE_ABILITIES,
  SAMPLE_AC,
  SAMPLE_CONDITIONS,
  SAMPLE_SKILLS,
  sampleRoll,
} from './gallerySamples.ts';
import styles from './DesignGallery.module.css';

type Width = 'phone' | 'tablet' | 'desktop';
const WIDTHS: { value: Width; label: string; px: number }[] = [
  { value: 'phone', label: 'Phone', px: 375 },
  { value: 'tablet', label: 'Tablet', px: 768 },
  { value: 'desktop', label: 'Desktop', px: 1100 },
];

const COLOR_GROUPS: { title: string; tokens: string[] }[] = [
  { title: 'Surfaces', tokens: ['bg', 'surface', 'surface-2', 'surface-3'] },
  {
    title: 'Text and lines',
    tokens: ['text', 'text-muted', 'text-subtle', 'border', 'border-strong'],
  },
  {
    title: 'Meaning',
    tokens: ['accent', 'accent-soft', 'positive', 'negative', 'warning', 'warning-soft'],
  },
  { title: 'Rolls', tokens: ['proficiency', 'expertise', 'advantage', 'disadvantage'] },
];

const TYPE_SCALE = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'] as const;
const TYPE_PX: Record<(typeof TYPE_SCALE)[number], number> = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  '2xl': 28,
  '3xl': 34,
};

/** Interactive sample state, shared by every frame so they stay in step. */
interface Sample {
  hp: { current: number; max: number; temp: number };
  deathSaves: { successes: number; failures: number };
  inspiration: boolean;
  hitDiceUsed: number;
  conditions: string[];
  exhaustion: number;
  counter: number;
}

const INITIAL_SAMPLE: Sample = {
  hp: { current: 31, max: 44, temp: 5 },
  deathSaves: { successes: 1, failures: 2 },
  inspiration: true,
  hitDiceUsed: 2,
  conditions: ['sample/prone'],
  exhaustion: 1,
  counter: 1,
};

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={page.card}>
      <SectionHeader title={title} />
      {children}
    </section>
  );
}

function Tokens() {
  return (
    <>
      <Card title="Type">
        <p className={styles.display}>Thorin Oakenshield</p>
        {TYPE_SCALE.map((size) => (
          <p
            key={size}
            style={{
              fontSize: `var(--font-size-${size})`,
              lineHeight: `var(--line-height-${size})`,
            }}
          >
            {TYPE_PX[size]} · The quick brown fox <span className="numeric">+12 / 18</span>
          </p>
        ))}
      </Card>
      {COLOR_GROUPS.map((group) => (
        <Card key={group.title} title={group.title}>
          <div className={styles.swatches}>
            {group.tokens.map((t) => (
              <div key={t} className={styles.swatch}>
                <span className={styles.chip} style={{ background: `var(--color-${t})` }} />
                <code>{t}</code>
              </div>
            ))}
          </div>
        </Card>
      ))}
      <Card title="Damage types">
        <div className={styles.damage}>
          {DAMAGE_TYPES.map((d) => (
            <span key={d} className={styles.damageChip} style={{ color: `var(--damage-${d})` }}>
              {d}
            </span>
          ))}
        </div>
      </Card>
      <Card title="Corners and elevation">
        <div className={styles.shapes}>
          {(['sm', 'md', 'lg', 'xl'] as const).map((r) => (
            <span key={r} className={styles.shape} style={{ borderRadius: `var(--radius-${r})` }}>
              {r}
            </span>
          ))}
          {[1, 2, 3].map((e) => (
            <span key={e} className={styles.shape} style={{ boxShadow: `var(--shadow-${e})` }}>
              shadow {e}
            </span>
          ))}
        </div>
      </Card>
    </>
  );
}

function Components({ sample, set }: { sample: Sample; set: (s: Partial<Sample>) => void }) {
  const explain = useExplain();
  const sheet = useSheet();
  const hpActions = {
    onDamage: (n: number) => {
      const fromTemp = Math.min(sample.hp.temp, n);
      set({
        hp: {
          ...sample.hp,
          temp: sample.hp.temp - fromTemp,
          current: Math.max(0, sample.hp.current - (n - fromTemp)),
        },
      });
    },
    onHeal: (n: number) =>
      set({ hp: { ...sample.hp, current: Math.min(sample.hp.max, sample.hp.current + n) } }),
    onTempHp: (n: number) => set({ hp: { ...sample.hp, temp: Math.max(sample.hp.temp, n) } }),
  };
  const conditions = SAMPLE_CONDITIONS.filter((c) => sample.conditions.includes(c.id));

  return (
    <>
      <Card title="Ability cards">
        <div className={styles.abilities}>
          {SAMPLE_ABILITIES.map((a) => (
            <AbilityCard
              key={a.ability}
              ability={a.ability}
              name={ABILITY_NAMES[a.ability]}
              score={derived(a.score, a.parts)}
              check={sampleRoll(modOf(a.score), {
                ...(a.ability === 'str' ? { mode: 'advantage', advantage: ['Rage'] } : {}),
              })}
              onExplain={() =>
                explain({
                  key: `gallery.${a.ability}`,
                  title: ABILITY_NAMES[a.ability],
                  derived: derived(a.score, a.parts),
                })
              }
            />
          ))}
        </div>
      </Card>
      <Card title="Stat pills">
        <div className={styles.pills}>
          <StatPill
            label="Armor Class"
            value={SAMPLE_AC.value}
            sub="Splint, shield"
            derived={SAMPLE_AC}
            onExplain={() =>
              explain({ key: 'gallery.ac', title: 'Armor Class', derived: SAMPLE_AC })
            }
          />
          <StatPill label="Initiative" roll={sampleRoll(1)} onExplain={() => {}} />
          <StatPill label="Speed" value={30} sub="climb 30" onExplain={() => {}} />
          <StatPill label="Proficiency" value="+3" onExplain={() => {}} />
          <StatPill
            label="Inspiration"
            value={sample.inspiration ? '★' : '☆'}
            sub="Heroic"
            pressed={sample.inspiration}
            onToggle={() => set({ inspiration: !sample.inspiration })}
          />
        </div>
      </Card>
      <Card title="Saves and skills">
        <ul className={styles.rows}>
          <RollRow
            label="Strength"
            rollLabel="Strength save"
            roll={sampleRoll(6, { proficiency: 'proficient' })}
            onExplain={() => {}}
          />
          {SAMPLE_SKILLS.map((s) => (
            <RollRow
              key={s.label}
              label={s.label}
              ability={s.ability}
              roll={s.roll}
              onExplain={() =>
                explain({
                  key: `gallery.${s.label}`,
                  title: s.label,
                  derived: s.roll.bonus,
                  bonus: true,
                })
              }
            />
          ))}
        </ul>
        <div className={page.row}>
          <ProficiencyMarker level="none" />
          <ProficiencyMarker level="half" />
          <ProficiencyMarker level="proficient" />
          <ProficiencyMarker level="expertise" />
          <RollButton label="Small roll" roll={sampleRoll(2)} size="sm" />
          <RollButton label="Roll" roll={sampleRoll(-1)} />
          <RollButton label="Big roll" roll={sampleRoll(11)} size="lg" />
        </div>
      </Card>
      <Card title="Hit points">
        <HpWidget
          values={sample.hp}
          actions={hpActions}
          onExplainMax={() =>
            explain({
              key: 'gallery.hp',
              title: 'Hit point maximum',
              derived: derived(44, [
                { label: 'Hit dice', value: 34, kind: 'base' },
                { label: 'CON modifier × 5', value: 10 },
              ]),
            })
          }
        />
        <div className={page.row}>
          <HpPill values={sample.hp} actions={hpActions} />
          <HpPill values={{ current: 0, max: 44, temp: 0 }} actions={hpActions} />
          <NeedsAttentionChip count={3} onOpen={() => {}} />
        </div>
      </Card>
      <Card title="Hit dice and death saves">
        <HitDice
          dice={[{ faces: 10, total: 5, used: sample.hitDiceUsed }]}
          onChange={(_, used) => set({ hitDiceUsed: used })}
        />
        <DeathSaves
          successes={sample.deathSaves.successes}
          failures={sample.deathSaves.failures}
          onChange={(deathSaves) => set({ deathSaves })}
          onRoll={() => {}}
        />
      </Card>
      <Card title="Conditions and exhaustion">
        <ConditionChips
          active={conditions}
          available={SAMPLE_CONDITIONS}
          onAdd={(id) => set({ conditions: [...sample.conditions, id] })}
          onRemove={(id) => set({ conditions: sample.conditions.filter((c) => c !== id) })}
        />
        <ExhaustionStepper level={sample.exhaustion} onChange={(n) => set({ exhaustion: n })} />
      </Card>
      <Card title="Contribution sheet">
        <ContributionSheet
          derived={SAMPLE_AC}
          note={<p>Splint armor and a shield</p>}
          onOverride={() => {}}
        />
      </Card>
      <Card title="Badges and markers">
        <div className={page.row}>
          <SourceBadge source="XPHB" />
          <ContentMissingBadge />
          <Badge variant="accent">Prepared</Badge>
          <Badge variant="override">Overridden</Badge>
          <OverrideMarker />
        </div>
      </Card>
      <Card title="Buttons and counter">
        <div className={page.row}>
          <Button variant="primary">Primary</Button>
          <Button>Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button size="sm">Small</Button>
          <Button disabled>Disabled</Button>
        </div>
        <Counter
          label="Example uses"
          value={sample.counter}
          max={3}
          onChange={(counter) => set({ counter })}
        />
        <Button
          onClick={() =>
            sheet.open({
              key: 'demo-1',
              title: 'Example rule',
              render: () => <p>Bottom sheets open in the app’s own direction and theme.</p>,
            })
          }
        >
          Open a bottom sheet
        </Button>
      </Card>
    </>
  );
}

/** A saved character to show in every frame. Changes stay in memory; nothing is saved. */
function useMainPreview(id: string) {
  const stored = useLiveQuery(
    async () => (id ? await repos().characters.get(id) : undefined),
    [id],
  );
  const [edited, setEdited] = useState<Character | null>(null);
  const character = edited?.id === id ? edited : stored;
  const index = useContentIndex(character);
  const sheet = useMemo(
    () =>
      character && index && character.log.length
        ? derive(character, index, { registry: featureEffects() })
        : undefined,
    [character, index],
  );
  if (!character || !index || !sheet) return undefined;
  const apply = (update: CharacterUpdate) => setEdited(update(character));
  return { character, index, sheet, apply };
}

export function DesignGallery() {
  const [direction, setDirection] = useDirection();
  const [width, setWidth] = useState<Width>('phone');
  const [show, setShow] = useState<'tokens' | 'components' | 'main'>('components');
  const [dirs, setDirs] = useState<Direction[]>(['a', 'b']);
  const [schemes, setSchemes] = useState<Scheme[]>(['light', 'dark']);
  const [sample, setSample] = useState<Sample>(INITIAL_SAMPLE);
  const characters = useLiveQuery(() => repos().characters.list(), []);
  const [characterId, setCharacterId] = useState('');
  const chosenId = characterId || characters?.find((c) => c.log.length)?.id || '';
  const preview = useMainPreview(show === 'main' ? chosenId : '');
  const conditionOptions = useConditionOptions() ?? [];
  const px = WIDTHS.find((w) => w.value === width)!.px;
  const set = (patch: Partial<Sample>) => setSample((s) => ({ ...s, ...patch }));
  const toggle = <T,>(list: T[], value: T) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const frames = dirs.flatMap((d) => schemes.map((s) => ({ d, s })));

  return (
    <>
      <TopBar title="Design gallery" backTo="/settings" />
      <div className={page.content}>
        <section className={page.card} aria-labelledby="direction-title">
          <h2 id="direction-title" className={page.cardTitle}>
            Design direction
          </h2>
          <p className={page.muted}>
            Two candidates for the design gate. The one picked here applies to the whole app on this
            device, so you can live with it for a while.
          </p>
          <div className={styles.choices} role="radiogroup" aria-labelledby="direction-title">
            {DIRECTIONS.map((d) => (
              <label key={d.value} className={styles.choice}>
                <input
                  type="radio"
                  name="direction"
                  checked={direction === d.value}
                  onChange={() => setDirection(d.value)}
                />
                <span>
                  <strong>{d.label}</strong>
                  <small>{d.description}</small>
                </span>
              </label>
            ))}
          </div>
        </section>
        <section className={page.card} aria-labelledby="preview-title">
          <h2 id="preview-title" className={page.cardTitle}>
            Compare
          </h2>
          <div className={styles.controls}>
            <label className={styles.control}>
              Show
              <select value={show} onChange={(e) => setShow(e.target.value as typeof show)}>
                <option value="components">Components</option>
                <option value="tokens">Tokens</option>
                <option value="main">A character’s Main tab</option>
              </select>
            </label>
            <label className={styles.control}>
              Width
              <select value={width} onChange={(e) => setWidth(e.target.value as Width)}>
                {WIDTHS.map((w) => (
                  <option key={w.value} value={w.value}>
                    {w.label} ({w.px})
                  </option>
                ))}
              </select>
            </label>
            {show === 'main' && (
              <label className={styles.control}>
                Character
                <select value={chosenId} onChange={(e) => setCharacterId(e.target.value)}>
                  {(characters ?? [])
                    .filter((c) => c.log.length)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
          </div>
          <div className={page.row}>
            {DIRECTIONS.map((d) => (
              <label key={d.value} className={styles.check}>
                <input
                  type="checkbox"
                  checked={dirs.includes(d.value)}
                  onChange={() => setDirs(toggle(dirs, d.value))}
                />
                {d.label}
              </label>
            ))}
            {(['light', 'dark'] as const).map((s) => (
              <label key={s} className={styles.check}>
                <input
                  type="checkbox"
                  checked={schemes.includes(s)}
                  onChange={() => setSchemes(toggle(schemes, s))}
                />
                {s === 'light' ? 'Light' : 'Dark'}
              </label>
            ))}
          </div>
          {show === 'main' && !preview && (
            <p className={page.muted}>
              No character to show yet: build one with the quick builder (Settings → Developer
              tools).
            </p>
          )}
        </section>
      </div>
      <div className={styles.frames}>
        {frames.map(({ d, s }) => (
          <div
            key={`${d}-${s}`}
            className={styles.frame}
            data-dir={d}
            data-scheme={s}
            style={{ width: px }}
            aria-label={`${DIRECTIONS.find((x) => x.value === d)!.label}, ${s}`}
            role="region"
          >
            <p className={styles.frameTitle}>
              {DIRECTIONS.find((x) => x.value === d)!.label} · {s}
            </p>
            <div className={styles.frameBody}>
              {show === 'tokens' && <Tokens />}
              {show === 'components' && <Components sample={sample} set={set} />}
              {show === 'main' && preview && (
                <MainTab {...preview} conditionOptions={conditionOptions} />
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
