// Canonical string forms for Refs and ChoiceKeys (plan §4.4).
//
//   RefKey:     <kind>:<id>
//   ChoiceKey:  <owner.kind>:<esc(owner.id)>#<slot>[@<n>]
//
// esc() percent-encodes only the reserved characters `: # @ %`, so ids stay readable.

import { ENTITY_KINDS, type EntityKind, type Ref, type RefKey } from './common.ts';
import type { ChoiceKey } from './character.ts';

const RESERVED = /[:#@%]/g;
const HAS_RESERVED = /[:#@%]/;

function esc(value: string): string {
  return value.replace(RESERVED, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
}

function unesc(value: string): string {
  return value.replace(/%([0-9A-F]{2})/gi, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
}

function isEntityKind(value: string): value is EntityKind {
  return (ENTITY_KINDS as readonly string[]).includes(value);
}

export function refKey(ref: Ref): RefKey {
  return `${ref.kind}:${esc(ref.id)}`;
}

export function parseRefKey(key: RefKey): Ref {
  const colon = key.indexOf(':');
  const kind = key.slice(0, colon);
  if (colon < 0 || !isEntityKind(kind)) throw new Error(`Invalid ref key: ${key}`);
  return { kind, id: unesc(key.slice(colon + 1)) };
}

export function sameRef(a: Ref, b: Ref): boolean {
  return a.kind === b.kind && a.id === b.id;
}

export function encodeChoiceKey(key: ChoiceKey): string {
  if (!key.slot || HAS_RESERVED.test(key.slot)) {
    throw new Error(`Invalid choice slot: "${key.slot}"`);
  }
  const instance = key.n === undefined ? '' : `@${key.n}`;
  return `${refKey(key.owner)}#${key.slot}${instance}`;
}

export function decodeChoiceKey(value: string): ChoiceKey {
  const hash = value.indexOf('#');
  if (hash < 0) throw new Error(`Invalid choice key: ${value}`);
  const owner = parseRefKey(value.slice(0, hash));
  const rest = value.slice(hash + 1);
  const at = rest.indexOf('@');
  const slot = at < 0 ? rest : rest.slice(0, at);
  if (!slot) throw new Error(`Invalid choice key: ${value}`);
  if (at < 0) return { owner, slot };
  const n = Number(rest.slice(at + 1));
  if (!Number.isInteger(n) || n < 0) throw new Error(`Invalid choice key: ${value}`);
  return { owner, slot, n };
}
