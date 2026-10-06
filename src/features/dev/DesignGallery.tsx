import { useState } from 'react';
import { TopBar } from '../../app/TopBar.tsx';
import page from '../../app/Page.module.css';
import { Badge } from '../../ui/Badge.tsx';
import { Button } from '../../ui/Button.tsx';
import { Counter } from '../../ui/Counter.tsx';
import { useSheet } from '../../ui/sheetContext.ts';

/** Dev-only component gallery. Phase 3 grows this into the design sign-off page. */
export function DesignGallery() {
  const [used, setUsed] = useState(1);
  const sheet = useSheet();

  return (
    <>
      <TopBar title="Design gallery" backTo="/settings" />
      <div className={page.content}>
        <section className={page.card}>
          <h2 className={page.cardTitle}>Buttons</h2>
          <div className={page.row}>
            <Button variant="primary">Primary</Button>
            <Button>Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button size="sm">Small</Button>
            <Button disabled>Disabled</Button>
          </div>
        </section>
        <section className={page.card}>
          <h2 className={page.cardTitle}>Badges</h2>
          <div className={page.row}>
            <Badge>XPHB</Badge>
            <Badge variant="accent">Prepared</Badge>
            <Badge variant="warning">Content not loaded</Badge>
            <Badge variant="override">Overridden</Badge>
          </div>
        </section>
        <section className={page.card}>
          <h2 className={page.cardTitle}>Counter</h2>
          <Counter label="Example uses" value={used} max={3} onChange={setUsed} />
        </section>
        <section className={page.card}>
          <h2 className={page.cardTitle}>Bottom sheet</h2>
          <div className={page.row}>
            <Button
              onClick={() =>
                sheet.open({
                  key: 'demo-1',
                  title: 'Example rule',
                  render: () => (
                    <Button
                      onClick={() =>
                        sheet.push({
                          key: 'demo-2',
                          title: 'Linked rule',
                          render: () => <p>A linked page with a back button.</p>,
                        })
                      }
                    >
                      Open a linked rule
                    </Button>
                  ),
                })
              }
            >
              Open sheet
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}
