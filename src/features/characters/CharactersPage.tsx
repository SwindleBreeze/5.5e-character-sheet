import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { Link } from 'react-router';
import { TopBar } from '../../app/TopBar.tsx';
import page from '../../app/Page.module.css';
import { useSources } from '../../content/hooks.ts';
import { repos } from '../../db/repos.ts';
import { detectEnv, shouldShowInstallGuide } from '../../db/storage.ts';
import type { Character } from '../../schema/index.ts';
import { Button } from '../../ui/Button.tsx';
import { useSheet } from '../../ui/sheetContext.ts';
import { InstallGuide } from '../settings/InstallGuide.tsx';
import { BackupReminder } from './BackupReminder.tsx';
import { StaleContentNotice } from './StaleContentNotice.tsx';
import styles from './CharactersPage.module.css';

function summary(character: Character): string {
  if (character.draft) return 'Being created · Continue';
  const level = character.log.length;
  return level === 0 ? 'Not built yet' : `Level ${level}`;
}

/** A draft opens the creation wizard where it was left (plan §9.3 step 4.4). */
function linkTo(character: Character): string {
  return character.draft
    ? `/new/${character.id}/${character.draft.step}`
    : `/c/${character.id}/main`;
}

export function CharactersPage() {
  const characters = useLiveQuery(() => repos().characters.list(), []);
  const sources = useSources();
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
        {characters && characters.length > 0 && <BackupReminder characters={characters} />}
        <StaleContentNotice />
        {sources !== undefined && sources.length === 0 && (
          <section className={page.card} aria-labelledby="first-run-title">
            <h2 id="first-run-title" className={page.cardTitle}>
              Import your group’s pack
            </h2>
            <p className={page.muted}>
              This app comes without game content. Open the content pack your group shared to get
              classes, spells and items.
            </p>
            <p>
              <Link to="/library/import">Import content</Link>
            </p>
          </section>
        )}
        {characters === undefined ? null : characters.length === 0 ? (
          <div className={page.empty}>
            <p>No characters yet.</p>
          </div>
        ) : (
          <ul className={styles.list}>
            {characters.map((c) => (
              <li key={c.id} className={styles.item}>
                <Link
                  to={linkTo(c)}
                  className={styles.link}
                  aria-label={c.draft ? `Continue creating ${c.name}` : undefined}
                >
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
