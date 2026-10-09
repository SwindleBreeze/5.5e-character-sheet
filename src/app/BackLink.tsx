import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useGoBack } from './history.ts';

/**
 * The app's back button: a link to the screen above, followed by going back in the history when
 * that screen is the one before (`useGoBack`), so the phone's back afterwards doesn't return.
 */
export function BackLink({
  to,
  flow,
  className,
  children,
}: {
  to: string;
  /** Paths that belong to this screen and are left with it (a wizard's steps). */
  flow?: string;
  className?: string;
  children: ReactNode;
}) {
  const goBack = useGoBack();
  return (
    <Link
      to={to}
      className={className}
      aria-label="Back"
      onClick={(e) => {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        goBack(to, flow);
      }}
    >
      {children}
    </Link>
  );
}
