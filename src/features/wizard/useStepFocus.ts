import { useEffect, useRef } from 'react';

/**
 * Moving to another step puts focus on its heading, so a screen reader reads where the player
 * is and Tab starts from the top of the step instead of the footer's buttons. Not on the first
 * render: opening the page leaves focus where the browser puts it.
 */
export function useStepFocus(step: string) {
  const heading = useRef<HTMLHeadingElement>(null);
  const shown = useRef<string | null>(null);
  useEffect(() => {
    if (shown.current !== null && shown.current !== step) {
      heading.current?.focus({ preventScroll: true });
    }
    shown.current = step;
  }, [step]);
  return heading;
}
