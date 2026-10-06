import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { TopBar } from '../../app/TopBar.tsx';
import page from '../../app/Page.module.css';
import { repos } from '../../db/repos.ts';
import { detectEnv, shouldShowInstallGuide } from '../../db/storage.ts';
import type { Character } from '../../schema/index.ts';
import { Button } from '../../ui/Button.tsx';
import { useSheet } from '../../ui/sheetContext.ts';
import { InstallGuide } from '../settings/InstallGuide.tsx';
import styles from './CharactersPage.module.css';

function summary(character: Character): string {
  const level = character.log.length;
  return level === 0 ? 'Not built yet' : `Level ${level}`;
}

export function CharactersPage() {
  const characters = useLiveQuery(() => repos().characters.list(), []);
  const showInstallGuide = useMemo(() => shouldShowInstallGuide(detectEnv()), []);
  const sheet = useSheet();

  function openMenu(character: Character) {
    sheet.open({
      key: `menu:${character.id}`,
      title: character.name,
      render: () => (
        <div className={page.row}>
          <Button
            onClick={async () => {
              await repos().characters.duplicate(character.id);
              sheet.close();
            }}
          >
            Duplicate
          </Button>
          <Button
            variant="danger"
            onClick={() =>
              sheet.push({
                key: `delete:${character.id}`,
                title: `Delete ${character.name}?`,
                render: () => (
                  <div className={page.content}>
                    <p>This removes the character from this device. It can't be undone.</p>
                    <Button
                      variant="danger"
                      onClick={async () => {
                        await repos().characters.remove(character.id);
                        sheet.close();
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                ),
              })
            }
          >
            Delete…
          </Button>
        </div>
      ),
    });
  }

  return (
    <>
      <TopBar title="Characters" />
      <div className={page.content}>
        {showInstallGuide && <InstallGuide compact />}
        {characters === undefined ? null : characters.length === 0 ? (
          <div className={page.empty}>
            <p>No characters yet.</p>
          </div>
        ) : (
          <ul className={styles.list}>
            {characters.map((c) => (
              <li key={c.id} className={styles.item}>
                <Link to={`/c/${c.id}/main`} className={styles.link}>
                  <span className={styles.avatar} aria-hidden="true">
                    {c.name.trim().charAt(0).toUpperCase() || '?'}
                  </span>
                  <span className={styles.text}>
                    <span className={styles.name}>{c.name}</span>
                    <span className={page.muted}>{summary(c)}</span>
                  </span>
                </Link>
                <button
                  type="button"
                  className={styles.more}
                  aria-label={`More actions for ${c.name}`}
                  onClick={() => openMenu(c)}
                >
                  ⋯
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Link to="/new/draft/class" className={styles.fab}>
        + New character
      </Link>
    </>
  );
}
