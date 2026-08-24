/**
 * WHY THIS EXISTS:
 *   Phase 0 boot shell. It renders no routes — Phase 1 replaces this file's
 *   body with the route table. What it does do is exercise the data layer and
 *   the rating engine once, so that "the scaffold works" is something you can
 *   see rather than something you have to take on faith.
 *
 * CONCEPTS: (none claimed — see below)
 *
 * WITHOUT THIS:
 *   `main.tsx` has nothing to mount, so `npm run dev` serves a blank page and
 *   there is no way to tell a working build from a data layer that throws on
 *   import. Both look identical: white screen.
 *
 *   NOTE: this file claims no matrix rows. The `useMemo` below is here because
 *   re-pricing the book on every render would be wrong, not because W3-D1-03 is
 *   being ticked off — that row belongs to the /policies page in Phase 2, where
 *   there is a keystroke to make the cost observable. Nothing is marked
 *   complete on the strength of a boot screen.
 *
 *   The `rateBook` timing printed here is the baseline for docs/render-counts.md:
 *   it is the cost that Phase 2's memoisation has to avoid paying per keystroke.
 */

import { useMemo } from 'react';
import styles from './App.module.css';
import { AS_OF, claims, customers, policies } from './shared/data';
import { formatCurrency, formatDate, formatNumber } from './shared/format';
import { rateBook } from './shared/rating';

export default function App() {
  const priced = useMemo(
    () => rateBook(policies, customers, claims),
    // Seed data is module-frozen: these identities never change, so this
    // computes exactly once for the life of the page.
    [],
  );

  const grossWrittenPremium = useMemo(() => {
    let total = 0;
    for (const breakdown of priced.values()) total += breakdown.annualPremium;
    return total;
  }, [priced]);

  return (
    <div className={styles.shell}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>Phase 0 — scaffold &amp; data layer</p>
        <h1>AEGIS — Policy &amp; Claims Console</h1>
        <p className={styles.lede}>
          The build boots, the seeded book is loaded and the rating engine has priced
          it. Routing, contexts and the layout shell arrive in Phase 1.
        </p>

        <dl className={styles.stats}>
          <div className={styles.row}>
            <dt className={styles.label}>Valuation date</dt>
            <dd className={styles.value}>{formatDate(AS_OF)}</dd>
          </div>
          <div className={styles.row}>
            <dt className={styles.label}>Customers</dt>
            <dd className={styles.value}>{formatNumber(customers.length)}</dd>
          </div>
          <div className={styles.row}>
            <dt className={styles.label}>Policies</dt>
            <dd className={styles.value}>{formatNumber(policies.length)}</dd>
          </div>
          <div className={styles.row}>
            <dt className={styles.label}>Claims</dt>
            <dd className={styles.value}>{formatNumber(claims.length)}</dd>
          </div>
          <div className={styles.row}>
            <dt className={styles.label}>Gross written premium</dt>
            <dd className={styles.value}>{formatCurrency(grossWrittenPremium)}</dd>
          </div>
        </dl>

        <p className={styles.note}>
          Open the console: <code>[rating] rateBook …</code> prints the milliseconds
          a full re-price costs. That figure is the budget Phase 2&apos;s memoisation
          has to keep off every keystroke.
        </p>
      </div>
    </div>
  );
}
