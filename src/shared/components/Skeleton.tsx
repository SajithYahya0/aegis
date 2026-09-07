import type { ReactElement, ReactNode } from 'react';
import styles from './Skeleton.module.css';

export interface SkeletonProps {
  variant: 'table' | 'card' | 'panel';
  /** `table`: body rows to reserve. `panel`: body lines. Ignored by `card`. */
  rows?: number;
  /** `table` only: column count, matched to the real table's header. */
  columns?: number;
  /** `card` only: how many label/value fields the real card renders. */
  fields?: number;
  /** Announced to screen readers in place of the silent placeholder. */
  label?: string;
}

/**
 * Column widths cycle through this ramp so the placeholder reads as tabular
 * data rather than as a solid grey block. Purely visual — the heights above
 * are what actually prevent the shift.
 */
const COLUMN_WIDTHS = ['70%', '90%', '55%', '45%', '80%', '65%'];

export function Skeleton({
  variant,
  rows = 6,
  columns = 6,
  fields = 6,
  label = 'Loading…',
}: SkeletonProps): ReactElement {
  if (variant === 'table') {
    return (
      <Announce label={label}>
        <table className={styles.table}>
          <thead>
            <tr>
              {Array.from({ length: columns }, (_, column) => (
                <th key={column}>
                  <span
                    className={styles.bar}
                    style={{ width: COLUMN_WIDTHS[column % COLUMN_WIDTHS.length] }}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, row) => (
              <tr key={row}>
                {Array.from({ length: columns }, (_, column) => (
                  <td key={column}>
                    <span
                      className={styles.bar}
                      style={{ width: COLUMN_WIDTHS[(row + column) % COLUMN_WIDTHS.length] }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Announce>
    );
  }

  if (variant === 'card') {
    return (
      <Announce label={label}>
        <div className={styles.card}>
          <span className={styles.cardHeadingBar} />
          <div className={styles.cardGrid}>
            {Array.from({ length: fields }, (_, field) => (
              <div key={field} className={styles.cardField}>
                <span className={styles.cardLabelBar} />
                <span className={styles.cardValueBar} />
              </div>
            ))}
          </div>
        </div>
      </Announce>
    );
  }

  return (
    <Announce label={label}>
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span className={styles.panelTitleBar} />
        </div>
        <div className={styles.panelBody}>
          {Array.from({ length: rows }, (_, row) => (
            <span
              key={row}
              className={styles.bar}
              style={{ width: COLUMN_WIDTHS[row % COLUMN_WIDTHS.length] }}
            />
          ))}
        </div>
      </div>
    </Announce>
  );
}

/**
 * Announces the wait to assistive tech and hides the decorative bars from it.
 *
 * The naive version — `role="presentation"` plus `aria-label` on the table
 * itself — is self-cancelling: `presentation` strips the element's semantics,
 * and an element with no role has nothing for a label to attach to, so the
 * label is dropped and a screen-reader user gets total silence during the
 * load. Splitting the two jobs is what makes both work: `role="status"` on a
 * wrapper carries the text (politely — it must not interrupt), and
 * `aria-hidden` on the placeholder markup keeps a screen reader from walking
 * ten rows of empty table cells that contain no information at all.
 */
function Announce({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      {/*
        Visually hidden, not `display: none`. A hidden element is removed from
        the accessibility tree too, so the announcement would be silent — and
        rendering the text visibly would add a line of height the real content
        does not have, reintroducing exactly the layout shift this component
        exists to prevent.
      */}
      <span className={styles.srOnly}>{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}
