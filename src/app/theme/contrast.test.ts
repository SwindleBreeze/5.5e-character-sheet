// Contrast in both themes (plan §10.3, step 7.8), worked out from tokens.css with the WCAG
// formula: 4.5:1 for text, 3:1 for the edges of controls and the focus ring.

import { describe, expect, it } from 'vitest';
import tokens from './tokens.css?raw';

/** The hex colours set in every rule for one scheme, merged in order. */
function palette(selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  const escaped = selector.replace(/[[\]']/g, (c) => `\\${c}`);
  for (const rule of tokens.matchAll(new RegExp(`(?:^|\\n)${escaped} \\{([^}]*)\\}`, 'g'))) {
    for (const [, name, hex] of rule[1]!.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})\b/gi)) {
      out[name!] = hex!;
    }
  }
  return out;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

const SURFACES = ['color-bg', 'color-surface', 'color-surface-2', 'color-surface-3'];
const TEXT = [
  'color-text',
  'color-text-muted',
  'color-text-subtle',
  'color-accent',
  'color-positive',
  'color-negative',
  'color-warning',
  'color-proficiency',
  'color-expertise',
  'color-advantage',
  'color-disadvantage',
];
const CONTROL_EDGES = ['color-border-strong', 'color-focus'];
const TINTS = ['accent', 'positive', 'negative', 'warning'];
/** Damage type chips sit on the page and on cards, not on the darkest surface. */
const DAMAGE_SURFACES = ['color-bg', 'color-surface', 'color-surface-2'];

const SCHEMES = {
  light: ":root,\n[data-scheme='light']",
  dark: "[data-scheme='dark']",
};

describe.each(Object.entries(SCHEMES))('contrast in the %s theme', (_, selector) => {
  const p = palette(selector);
  /** Every pair below its minimum, as "fg on bg: ratio". */
  const failing = (pairs: [string, string][], min: number) =>
    pairs
      .map(([fg, bg]) => [fg, bg, contrast(p[fg]!, p[bg]!)] as const)
      .filter(([, , ratio]) => !(ratio >= min))
      .map(([fg, bg, ratio]) => `${fg} on ${bg}: ${ratio.toFixed(2)}`);
  const all = (fgs: string[], bgs: string[]): [string, string][] =>
    fgs.flatMap((fg) => bgs.map((bg): [string, string] => [fg, bg]));

  it('has every token the checks use', () => {
    const needed = [...SURFACES, ...TEXT, ...CONTROL_EDGES, 'color-accent-contrast'];
    expect(needed.filter((t) => !p[t])).toEqual([]);
    expect(Object.keys(p).filter((k) => k.startsWith('damage-')).length).toBeGreaterThan(10);
  });

  it('text reads at 4.5:1 on every surface', () => {
    expect(failing(all(TEXT, SURFACES), 4.5)).toEqual([]);
  });

  it('text reads at 4.5:1 on the tinted backgrounds and the accent button', () => {
    const pairs: [string, string][] = [
      ...TINTS.flatMap((t): [string, string][] => [
        [`color-${t}`, `color-${t}-soft`],
        ['color-text', `color-${t}-soft`],
        ['color-text-muted', `color-${t}-soft`],
      ]),
      ['color-accent-contrast', 'color-accent'],
    ];
    expect(failing(pairs, 4.5)).toEqual([]);
  });

  it('control edges and the focus ring stand out at 3:1', () => {
    expect(failing(all(CONTROL_EDGES, SURFACES), 3)).toEqual([]);
  });

  it('damage type colours read at 4.5:1', () => {
    const damage = Object.keys(p).filter((k) => k.startsWith('damage-'));
    expect(failing(all(damage, DAMAGE_SURFACES), 4.5)).toEqual([]);
  });
});

describe('contrast()', () => {
  it('matches the WCAG examples', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });
});
