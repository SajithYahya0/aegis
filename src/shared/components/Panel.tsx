/**
 * WHY THIS EXISTS:
 *   A generic card wrapper — optional title, optional header actions, and a
 *   `children` slot for the body. /policies uses it twice (filters,
 *   recently viewed) so both widgets share one visual container instead of
 *   each hand-rolling its own `<section>` and heading markup.
 *
 * CONCEPTS: W1-14
 *
 * WITHOUT THIS:
 *   Every panel-like widget on every page reimplements its own header/body
 *   markup and its own `.module.css` for the same card chrome — border,
 *   radius, padding, shadow. The moment one of those copies drifts (a
 *   missing `--shadow-panel`, a different padding scale), the console stops
 *   looking like one coherent app and starts looking like several different
 *   ones stapled together.
 */

import type { ReactElement, ReactNode } from 'react';
import styles from './Panel.module.css';

export interface PanelProps {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function Panel({ title, actions, children }: PanelProps): ReactElement {
  return (
    <section className={styles.panel}>
      {title || actions ? (
        <header className={styles.header}>
          {title ? <h2 className={styles.title}>{title}</h2> : null}
          {actions}
        </header>
      ) : null}
      <div className={styles.body}>{children}</div>
    </section>
  );
}
