// The header's Concentration chip opens what concentrating means and a way to end it
// (plan §9.2, step 3.22).

import { setConcentration } from '../../../engine/play/reducers.ts';
import { useSheet } from '../../../ui/sheetContext.ts';
import type { SheetBindings } from '../sheetBindings.ts';
import { ConcentrationStatus } from './MoreSheets.tsx';

/** Opens the concentration page from the header's chip. */
export function useConcentrationStatus(bindings: SheetBindings) {
  const ui = useSheet();
  return () =>
    ui.open({
      key: 'concentration-status',
      title: 'Concentration',
      render: () => (
        <ConcentrationStatus
          bindings={bindings}
          onEnd={() => {
            ui.close();
            bindings.apply((c) => setConcentration(c, null));
          }}
        />
      ),
    });
}
