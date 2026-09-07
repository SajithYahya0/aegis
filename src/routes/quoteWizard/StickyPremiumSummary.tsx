import { useRef, type ReactElement } from 'react';
import { formatCurrency } from '../../shared/format';
import styles from './StickyPremiumSummary.module.css';

export interface StickyPremiumSummaryProps {
  premium: number;
}

export function StickyPremiumSummary({ premium }: StickyPremiumSummaryProps): ReactElement {
  const currentPremiumRef = useRef(premium);
  const previousPremiumRef = useRef<number | undefined>(undefined);
  if (currentPremiumRef.current !== premium) {
    previousPremiumRef.current = currentPremiumRef.current;
    currentPremiumRef.current = premium;
  }
  const previousPremium = previousPremiumRef.current;

  const delta = previousPremium === undefined || previousPremium === premium ? null : premium - previousPremium;

  return (
    <div className={styles.bar}>
      <span className={styles.label}>Indicative premium</span>
      <strong className={styles.amount}>{formatCurrency(premium)}</strong>
      {delta !== null ? (
        <span className={delta > 0 ? styles.up : styles.down}>
          {delta > 0 ? '▲' : '▼'} was {formatCurrency(previousPremium!)}
        </span>
      ) : null}
    </div>
  );
}
