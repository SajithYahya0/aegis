import type { ReactElement } from 'react';
import styles from '../aegis.module.css';

const ROWS = [1, 2, 3];

export default function Loading(): ReactElement {
  return (
    <main aria-busy="true">
      <h1>Checking the policy…</h1>
      {ROWS.map((row) => (
        <div key={row} className={styles.skeleton} style={{ width: `${100 - row * 12}%` }} />
      ))}
    </main>
  );
}
