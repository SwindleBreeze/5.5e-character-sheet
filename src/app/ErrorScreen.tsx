// When something breaks (plan 9.8): instead of a blank page, what happened, a way to copy the
// details for a bug report, and a reload. Characters are saved as they change, so a reload
// loses at most the last second. The details say nothing of the character or its content.

import { Component, useState, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '../ui/Button.tsx';
import page from './Page.module.css';
import { RELEASE } from './release.ts';

/** What a bug report needs: app and version, where, what, and the browser. */
function errorDetails(error: unknown, where: string, stack?: string): string {
  const e = error instanceof Error ? error : new Error(String(error));
  return [
    `${RELEASE.name} ${RELEASE.version}`,
    `Screen: ${where || '/'}`,
    `Error: ${e.name}: ${e.message}`,
    `Browser: ${typeof navigator === 'undefined' ? 'unknown' : navigator.userAgent}`,
    '',
    stack ?? e.stack ?? '',
  ]
    .join('\n')
    .trim();
}

function ErrorView({ details }: { details: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={page.content} role="alert">
      <section className={page.card}>
        <h1 className={page.cardTitle}>Something went wrong</h1>
        <p>
          The app hit an error it didn’t expect. Your characters are saved as you go, so reloading
          should bring you back.
        </p>
        <p className={page.muted}>
          If it keeps happening, copy the details and send them with what you were doing.
        </p>
        <div className={page.row}>
          <Button variant="primary" onClick={() => window.location.reload()}>
            Reload
          </Button>
          <Button
            onClick={() =>
              void navigator.clipboard?.writeText(details).then(
                () => setCopied(true),
                () => setCopied(false),
              )
            }
          >
            {copied ? 'Copied' : 'Copy details'}
          </Button>
        </div>
        <details>
          <summary>Details</summary>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 'var(--font-size-xs)' }}>{details}</pre>
        </details>
      </section>
    </div>
  );
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { details: string | null }> {
  override state = { details: null as string | null };

  static getDerivedStateFromError(error: unknown) {
    return { details: errorDetails(error, window.location.hash.replace(/^#/, '')) };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    this.setState({
      details: errorDetails(
        error,
        window.location.hash.replace(/^#/, ''),
        `${error instanceof Error ? (error.stack ?? '') : ''}${info.componentStack ?? ''}`,
      ),
    });
  }

  override render() {
    return this.state.details ? <ErrorView details={this.state.details} /> : this.props.children;
  }
}
