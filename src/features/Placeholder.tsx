import type { ReactNode } from 'react';
import { TopBar } from '../app/TopBar.tsx';
import page from '../app/Page.module.css';

/** Stand-in screen for routes whose feature lands in a later phase. */
export function Placeholder({
  title,
  backTo,
  children,
}: {
  title: string;
  backTo?: string;
  children: ReactNode;
}) {
  return (
    <>
      <TopBar title={title} backTo={backTo} />
      <div className={page.content}>
        <div className={page.empty}>{children}</div>
      </div>
    </>
  );
}
