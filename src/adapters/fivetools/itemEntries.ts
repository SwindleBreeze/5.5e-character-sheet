// Shared item text. Families of items (Ring of Fire/Cold/… Resistance, Ioun Stones, Dragon Scale
// Mail) store their text once as an `itemEntry` template; each item's entries are just
// `{#itemEntry Ring of Resistance|XDMG}`. Templates use `{{item.<field>}}` and
// `{{getFullImmRes item.resist}}`, filled from the item. Separately, `itemTypeAdditionalEntries`
// add text to every item of a type (2014 tool rules).

import { asArray, isObject, type RawEntity } from './raw.ts';
import type { ReportBuilder } from './report.ts';

const REF = /^\{#itemEntry ([^}]+)\}$/;

function key(name: string, source: string): string {
  return `${name}|${source}`.toLowerCase();
}

/** Item type UID, `GS` → `gs|phb` (the item type default source). */
function typeUid(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  const [code = '', source = 'PHB'] = value.split('|');
  return key(code, source || 'PHB');
}

/** `['acid', 'fire', 'cold']` → `acid, fire, and cold`. */
function joinList(values: string[]): string {
  if (values.length <= 2) return values.join(' and ');
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`;
}

function fieldText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value))
    return joinList(value.filter((v): v is string => typeof v === 'string'));
  return '';
}

function fill(template: unknown, item: RawEntity): unknown {
  if (typeof template === 'string') {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, expr: string) => {
      const m = /^(?:getFullImmRes\s+)?item\.(\w+)$/.exec(expr.trim());
      return m?.[1] ? fieldText(item[m[1]]) : match;
    });
  }
  if (Array.isArray(template)) return template.map((t) => fill(t, item));
  if (isObject(template)) {
    return Object.fromEntries(Object.entries(template).map(([k, v]) => [k, fill(v, item)]));
  }
  return template;
}

export function resolveItemEntries(records: Record<string, RawEntity[]>, report: ReportBuilder) {
  const templates = new Map<string, unknown[]>();
  for (const t of records.itemEntry ?? []) {
    templates.set(key(String(t.name), String(t.source)), asArray(t.entriesTemplate));
  }
  const byType = new Map<string, unknown[]>();
  for (const t of records.itemTypeAdditionalEntries ?? []) {
    const uid = typeUid(t.appliesTo);
    if (uid) byType.set(uid, asArray(t.entries));
  }

  const expand = (target: RawEntity, fields: RawEntity) => {
    if (!Array.isArray(target.entries)) return;
    target.entries = target.entries.flatMap((entry: unknown) => {
      const m = typeof entry === 'string' ? REF.exec(entry) : null;
      if (!m?.[1]) return [entry];
      const [name = '', source = 'DMG'] = m[1].split('|');
      const template = templates.get(key(name, source || 'DMG'));
      if (!template) {
        report.warn('itemEntryMissing', `Shared item text not found: ${m[1]}`, fields);
        return [entry];
      }
      return fill(template, fields) as unknown[];
    });
  };

  for (const prop of ['baseitem', 'item', 'itemGroup']) {
    for (const item of records[prop] ?? []) {
      expand(item, item);
      const extra = byType.get(typeUid(item.type) ?? '');
      if (extra) item.entries = [...asArray(item.entries), ...extra];
    }
  }
  // Magic variants keep their text and fields in `inherits`.
  for (const variant of records.magicvariant ?? []) {
    if (isObject(variant.inherits)) expand(variant.inherits, { ...variant, ...variant.inherits });
  }
}
