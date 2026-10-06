// Tokenizer for inline tags in tagged strings (plan §4.2): `{@tag part0|part1|part2}`.
// Tags may nest (`{@b {@spell Fireball|XPHB}}`); `|` splits parts only at the tag's own level.
// Pure and allocation-light; results are memoized by the renderer, not here.

export interface TextToken {
  type: 'text';
  text: string;
}

export interface TagToken {
  type: 'tag';
  /** Tag name without `@`, e.g. `spell`. */
  tag: string;
  /** Everything after the tag name, e.g. `Fireball|XPHB`. */
  content: string;
  /** `content` split on top-level `|`. Always at least one element. */
  parts: string[];
  /** The whole tag including braces. */
  raw: string;
}

export type Token = TextToken | TagToken;

/** Index of the `}` closing the brace at `open`, or -1. */
function findClose(input: string, open: number): number {
  let depth = 0;
  for (let i = open; i < input.length; i++) {
    const ch = input[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Split on `|` that are not inside nested braces. */
function splitParts(content: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '|' && depth === 0) {
      parts.push(content.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(content.slice(start));
  return parts;
}

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let textStart = 0;
  let i = input.indexOf('{@');
  while (i >= 0) {
    const close = findClose(input, i);
    if (close < 0) break; // Unclosed tag: the rest is plain text.
    if (i > textStart) tokens.push({ type: 'text', text: input.slice(textStart, i) });
    const inner = input.slice(i + 2, close);
    const space = inner.search(/\s/);
    const tag = space < 0 ? inner : inner.slice(0, space);
    const content = space < 0 ? '' : inner.slice(space + 1);
    tokens.push({
      type: 'tag',
      tag,
      content,
      parts: splitParts(content),
      raw: input.slice(i, close + 1),
    });
    textStart = close + 1;
    i = input.indexOf('{@', textStart);
  }
  if (textStart < input.length) tokens.push({ type: 'text', text: input.slice(textStart) });
  return tokens;
}

/** Top-level segments: plain text pieces and raw tags, in order. Joining them gives the input. */
export function splitByTags(input: string): string[] {
  return tokenize(input).map((t) => (t.type === 'text' ? t.text : t.raw));
}

export function hasTags(input: string): boolean {
  return input.includes('{@');
}
