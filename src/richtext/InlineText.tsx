import { useContext, useMemo, type ReactNode } from 'react';
import { refKey, type Ref } from '../schema/index.ts';
import { useSheet } from '../ui/sheetContext.ts';
import { EntitySheet } from './EntitySheet.tsx';
import { InSheetContext } from './inSheet.ts';
import { tokenize, type TagToken } from './parseTags.ts';
import styles from './richtext.module.css';
import { refFromTag, stripTags, tagCategory, tagDisplay, tagFormatting } from './tagRegistry.ts';

function EntityLink({
  entityRef,
  title,
  children,
}: {
  entityRef: Ref;
  title: string;
  children: ReactNode;
}) {
  const sheet = useSheet();
  const inSheet = useContext(InSheetContext);
  return (
    <button
      type="button"
      className={styles.link}
      onClick={() => {
        const page = {
          key: refKey(entityRef),
          title,
          render: () => <EntitySheet entityRef={entityRef} />,
        };
        if (inSheet) sheet.push(page);
        else sheet.open(page);
      }}
    >
      {children}
    </button>
  );
}

function Tag({ token }: { token: TagToken }) {
  const display = tagDisplay(token);
  const inner = display.includes('{@') ? <InlineText text={display} /> : display;

  switch (tagCategory(token.tag)) {
    case 'entity': {
      const ref = refFromTag(token);
      if (!ref) return <>{inner}</>;
      const title = stripTags(token.parts[0] ?? '').replace(/\s*\[[^\]]*\]\s*$/, '');
      return (
        <EntityLink entityRef={ref} title={title}>
          {inner}
        </EntityLink>
      );
    }
    case 'roll':
      // Tap-to-roll arrives with the dice roller in phase 3.
      return <span className={styles.roll}>{inner}</span>;
    case 'format':
      switch (tagFormatting(token.tag)) {
        case 'bold':
          return <strong>{inner}</strong>;
        case 'italic':
          return <em>{inner}</em>;
        case 'underline':
          return <u>{inner}</u>;
        case 'strike':
          return <s>{inner}</s>;
        case 'sup':
          return <sup>{inner}</sup>;
        case 'sub':
          return <sub>{inner}</sub>;
        case 'code':
          return <code>{inner}</code>;
        case 'note':
          return <span className={styles.note}>{inner}</span>;
        default:
          return <>{inner}</>;
      }
    default:
      return <>{inner}</>;
  }
}

/** One tagged string, inline. Tags become links, dice and formatting. */
export function InlineText({ text }: { text: string }) {
  const tokens = useMemo(() => tokenize(text), [text]);
  return <>{tokens.map((t, i) => (t.type === 'text' ? t.text : <Tag key={i} token={t} />))}</>;
}
