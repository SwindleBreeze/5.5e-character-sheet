// Pay-then-do for costs that need a choice: asks for the slot or Hit Die size in the bottom
// sheet when one is needed, otherwise goes straight ahead.

import type { DerivedCost, DerivedSheet } from '../../../engine/derive/types.ts';
import { choicesNeeded, type CostChoice } from '../../../engine/play/costs.ts';
import { useSheet } from '../../../ui/sheetContext.ts';
import { CostPicker } from './CostPicker.tsx';

export function useCostPicker() {
  const ui = useSheet();
  return (
    sheet: DerivedSheet,
    costs: readonly DerivedCost[],
    labels: { title: string; confirm: string },
    run: (choice: CostChoice) => void,
  ) => {
    const needs = choicesNeeded(sheet, costs);
    if (!needs.slot && !needs.hitDie) {
      run({});
      return;
    }
    ui.open({
      key: `pay:${labels.title}`,
      title: labels.title,
      render: () => (
        <CostPicker
          sheet={sheet}
          needs={needs}
          confirmLabel={labels.confirm}
          onConfirm={(choice) => {
            ui.close();
            run(choice);
          }}
        />
      ),
    });
  };
}
