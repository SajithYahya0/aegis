/**
 * WHY THIS EXISTS:
 *   The `<Suspense fallback>` every lazy boundary in the app hands React.
 *   Three variants — `table`, `card`, `panel` — each built to occupy the same
 *   vertical space as the real component it stands in for, so the moment the
 *   chunk lands nothing below it moves.
 *
 * CONCEPTS: W3-D3-04, W3-D3-03
 *
 * WITHOUT THIS:
 *   The honest alternative is `fallback={<p>Loading…</p>}`, and it is worse in
 *   a specific, measurable way rather than merely a duller one. A one-line
 *   paragraph is ~19px tall. The policy table it replaces is a header row plus
 *   up to ten body rows — roughly 210px. So the sequence a user actually sees
 *   is: chunk requested, page collapses to a single line, everything below the
 *   boundary (the recently-viewed panel, the footer) jumps ~190px up the
 *   viewport, then 300ms later the chunk resolves and everything jumps back
 *   down. Anything the user was reaching for with the mouse has moved twice.
 *   That is cumulative layout shift, and it is caused by the fallback, not by
 *   the loading.
 *
 *   The dimension matching is therefore the entire point of this file, and it
 *   is done by construction, not by eyeballing:
 *
 *     • `table` renders a real `<table>` with a real `<thead>`, so the global
 *       `th` rules (var(--fs-xs), uppercase, letter-spacing) apply to it
 *       exactly as they do to the real header, and each placeholder bar is
 *       `1.45em` tall — the line box of one row of text at whatever font size
 *       that cell inherits. A skeleton row is the same height as a real row
 *       because both are one line box, not because a pixel value was guessed.
 *
 *     • `panel` restates Panel.module.css's border, radius and padding tokens
 *       so a `panel` skeleton and a titled `<Panel>` are the same height.
 *
 *     • `card` matches the summary card on /policies/:id — heading, then an
 *       auto-fit field grid on the same `minmax(140px, 1fr)` track as the real
 *       one, so the field count wraps to the same number of lines at the same
 *       viewport width.
 *
 *   What this cannot pin is column *width* under `table-layout: auto`: both
 *   the skeleton and the real table size their columns from their content, and
 *   the two contents differ. Horizontal jitter inside the table on swap is
 *   accepted; vertical shift of the page around it is not, and that is the
 *   shift that moves things out from under a cursor.
 */

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
