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
