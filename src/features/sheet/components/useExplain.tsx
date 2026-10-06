// Opening the contribution sheet for a number (plan §8.2 rule 3).

import { useSheet } from '../../../ui/sheetContext.ts';
import { ContributionSheet, type ContributionSheetProps } from './ContributionSheet.tsx';

export interface ExplainOptions extends ContributionSheetProps {
  /** Stable key, e.g. `skill.athletics`. */
  key: string;
  title: string;
}

/** Open the contribution sheet for a number. Setting an override closes it. */
export function useExplain(): (opts: ExplainOptions) => void {
  const sheet = useSheet();
  return ({ key, title, onOverride, ...props }) =>
    sheet.open({
      key: `explain:${key}`,
      title,
      render: () => (
        <ContributionSheet
          {...props}
          {...(onOverride
            ? {
                onOverride: (value: number | undefined) => {
                  onOverride(value);
                  sheet.close();
                },
              }
            : {})}
        />
      ),
    });
}
