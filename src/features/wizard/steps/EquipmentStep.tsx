// Step 5: starting equipment (plan §9.3, step 4.4). The class's and the background's lettered
// options; an "any …" entry (any musical instrument, any simple weapon) gets an item picker.
// Armor, a Shield and a weapon are equipped, and coins go to the purse (`syncStartingEquipment`).

import {
  anyEquipmentType,
  anyItemKey,
  equipmentOptionText,
  equipmentTypeItems,
  EQUIPMENT_TYPES,
  pickedEquipment,
  startingEquipmentOwners,
} from '../../../engine/build/equipment.ts';
import { setPick } from '../../../engine/play/features.ts';
import type { Character, Id, Ref } from '../../../schema/index.ts';
import page from '../../../app/Page.module.css';
import inventory from '../../sheet/inventory/inventory.module.css';
import type { WizardBindings } from '../bindings.ts';
import styles from '../wizard.module.css';

const SLOT_WORDS: Record<string, string> = {
  armor: 'worn',
  shield: 'shield',
  mainHand: 'in hand',
  offHand: 'in off hand',
  bothHands: 'in both hands',
  worn: 'worn',
};

function setAnyItem(c: Character, key: string, id: Id): Character {
  return {
    ...c,
    draft: { step: 'equipment', ...c.draft, anyItems: { ...c.draft?.anyItems, [key]: id } },
  };
}

export function EquipmentStep(b: WizardBindings) {
  const { character, content, sheet, apply } = b;
  const owners = startingEquipmentOwners(character, content.index);
  const tools = new Set(sheet?.proficiencies.tools.map((t) => t.value) ?? []);

  const choose = (owner: Ref, key: string, text: string) =>
    apply((c) =>
      setPick(
        c,
        { owner, slot: 'equipment' },
        { values: [key], labels: [text], entryIndex: 0, via: 'creation' },
      ),
    );

  const purse = (['pp', 'gp', 'ep', 'sp', 'cp'] as const)
    .filter((k) => character.currency[k] > 0)
    .map((k) => `${character.currency[k]} ${k.toUpperCase()}`)
    .join(', ');

  return (
    <>
      <p className={styles.intro}>
        Take the equipment your class and background offer, or gold to buy your own instead.
      </p>
      {!owners.length && <p className={inventory.muted}>Choose a class and a background first.</p>}
      {owners.map((owner) => {
        const picked = pickedEquipment(character, owner.ref, owner.options);
        const name = `equipment-${owner.ref.kind}`;
        return (
          <section key={owner.ref.id} className={page.card} aria-label={`${owner.name} equipment`}>
            <h2 className={page.cardTitle}>{owner.name}</h2>
            <ul className={styles.cards} aria-label={`${owner.name} options`}>
              {owner.options.map((o) => {
                const text = equipmentOptionText(o, content.index);
                return (
                  <li key={o.key} className={styles.card} data-selected={picked?.key === o.key}>
                    <label className={styles.pick}>
                      <input
                        type="radio"
                        name={name}
                        checked={picked?.key === o.key}
                        onChange={() => choose(owner.ref, o.key, text)}
                      />
                      <span className={styles.pickText}>
                        <span className={styles.pickName}>Option {o.key}</span>
                        <span className={styles.pickDetail}>{text}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {picked?.items.map((grant, i) => {
              const code = anyEquipmentType(grant);
              if (!code) return null;
              const key = anyItemKey(owner.ref, picked.key, i);
              const items = equipmentTypeItems(content.catalog, code);
              // Tools the character is proficient with first (a Bard's instruments).
              const sorted = [
                ...items.filter((it) => tools.has(it.id)),
                ...items.filter((it) => !tools.has(it.id)),
              ];
              const label = `Any ${EQUIPMENT_TYPES[code]!.label}`;
              return (
                <label key={key} className={inventory.field}>
                  <span className={inventory.fieldLabel}>{label}</span>
                  <select
                    aria-label={label}
                    value={character.draft?.anyItems?.[key] ?? ''}
                    onChange={(e) => apply((c) => setAnyItem(c, key, e.target.value))}
                  >
                    <option value="" disabled>
                      Choose…
                    </option>
                    {sorted.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name}
                        {tools.has(it.id) ? ' (proficient)' : ''}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
          </section>
        );
      })}
      {owners.length > 0 && (
        <section className={page.card} aria-label="What you start with">
          <h2 className={page.cardTitle}>What you start with</h2>
          {character.inventory.length ? (
            <ul aria-label="Starting items">
              {character.inventory.map((r) => (
                <li key={r.uid}>
                  {r.quantity > 1 ? `${r.quantity} × ` : ''}
                  {r.name}
                  {r.equipped ? ` (${SLOT_WORDS[r.equipped]})` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p className={inventory.muted}>No items yet.</p>
          )}
          <p>
            Coins: <strong>{purse || 'none'}</strong>
          </p>
        </section>
      )}
    </>
  );
}
