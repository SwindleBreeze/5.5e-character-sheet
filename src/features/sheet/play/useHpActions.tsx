// Damage, healing and temporary HP from the header and the Main tab (plan §9.2, step 3.22).
// Damage taken while concentrating asks for the Constitution save.

import { applyDamage, heal, setConcentration, setTempHp } from '../../../engine/play/reducers.ts';
import { useSheet } from '../../../ui/sheetContext.ts';
import type { HpActions } from '../components/vitals.tsx';
import { nameOf, type SheetBindings } from '../sheetBindings.ts';
import { ConcentrationSheet } from './ConcentrationSheet.tsx';

export function useHpActions({ character, sheet, index, apply }: SheetBindings): HpActions {
  const ui = useSheet();
  return {
    onDamage: (n) => {
      apply((c) => applyDamage(c, sheet, n));
      const effect = character.state.concentration;
      // Damage doesn't break it (Boon of the Iron Mind): no save to make.
      if (!effect || sheet.hp.current === 0 || sheet.concentrationUnbreakable) return;
      // What gets past temporary HP and the ward reaches HP.
      const rest = n - sheet.hp.temp - (sheet.hp.ward?.current ?? 0);
      ui.open({
        key: 'concentration',
        title: 'Concentration',
        render: () => (
          <ConcentrationSheet
            effect={nameOf(index, effect.kind, effect.id)}
            damage={n}
            dropped={rest >= sheet.hp.current}
            save={sheet.concentration}
            onKeep={ui.close}
            onLose={() => {
              ui.close();
              apply((c) => setConcentration(c, null));
            }}
          />
        ),
      });
    },
    onHeal: (n) => apply((c) => heal(c, sheet, n)),
    // A feature that adds to Temporary HP gained (Boon of Bountiful Health) adds here too.
    onTempHp: (n) => apply((c) => setTempHp(c, n + (sheet.hp.tempBonus?.value ?? 0))),
  };
}
