// Undo the last level (plan §9.4, step 5.3): what goes, confirmed first; then what the lower
// level put right is said in a notice.

import { featureEffects } from '../../engine/featureEffects/index.ts';
import { undoLastLevel, undoPreview } from '../../engine/build/undo.ts';
import { Button } from '../../ui/Button.tsx';
import { useRoller } from '../../ui/rollerContext.ts';
import inventory from '../sheet/inventory/inventory.module.css';
import { nameOf, type SheetBindings } from '../sheet/sheetBindings.ts';

export function UndoLevelSheet({
  bindings,
  onClose,
}: {
  bindings: SheetBindings;
  onClose: () => void;
}) {
  const { character, index, apply } = bindings;
  const roller = useRoller();
  const preview = undoPreview(character, index);
  if (!preview) return <p className={inventory.muted}>A level 1 character has no level to undo.</p>;
  const undo = () => {
    const result = undoLastLevel(character, index, featureEffects());
    apply(() => result.character);
    const notes = [
      ...result.trimmed.map((t) => `${t.owner}: ${t.labels.join(', ')} removed`),
      ...result.unprepared.map(
        (u) =>
          `${u.caster}: ${u.spells.map((id) => nameOf(index, 'spell', id)).join(', ')} unprepared`,
      ),
    ];
    roller.notify({
      label: `Back to level ${preview.charLevel - 1}`,
      detail: notes.join(' · ') || `${preview.className} ${preview.classLevel} removed`,
    });
    onClose();
  };
  return (
    <div className={inventory.form}>
      <p>
        This removes level {preview.charLevel}: {preview.className} {preview.classLevel}
        {preview.subclass ? `, and the ${preview.subclass} chosen on it` : ''}.
      </p>
      {preview.picks.length > 0 ? (
        <>
          <p className={inventory.muted}>The choices made on it go with it:</p>
          <ul aria-label="Choices to remove">
            {preview.picks.map((p, i) => (
              <li key={i}>
                {p.owner}: {p.labels.join(', ') || 'nothing picked'}
                {p.manual ? ' (added by hand)' : ''}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className={inventory.muted}>No choices were made on it.</p>
      )}
      <p className={inventory.muted}>
        Picks that allow fewer at the lower level keep their first ones; spells prepared beyond the
        new limit are unprepared; spent slots, Hit Dice and uses are kept within the new maximums.
      </p>
      <div className={inventory.actions}>
        <Button variant="danger" onClick={undo}>
          Undo level {preview.charLevel}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Keep it
        </Button>
      </div>
    </div>
  );
}
