import type { ReactElement } from 'react';
import { useRenewalCountdown } from '../../shared/hooks/useRenewalCountdown';
import { formatNumber } from '../../shared/format';
import styles from './RenewalCountdown.module.css';

export interface RenewalCountdownProps {
  endDate: string;
}

/**
 * Grouped, not zero-padded: `3,962 days`. Zero-padding a four-digit figure to a
 * fixed width buys column alignment nobody needs here — there is one of these
 * per page, not a table of them — at the cost of reading like a serial number.
 */
function formatDaysRemaining(days: number, isExpired: boolean): string {
  if (isExpired) return '0 days';
  if (days === 0) return 'Today';
  return days === 1 ? '1 day' : `${formatNumber(days)} days`;
}

export function RenewalCountdown({ endDate }: RenewalCountdownProps): ReactElement {
  const { daysRemaining, isExpired, isIdle } = useRenewalCountdown(endDate);

  return (
    <div className={styles.bar}>
      <span className={styles.label}>{isExpired ? 'Renewal overdue' : 'Renews in'}</span>
      <span className={styles.clock}>{formatDaysRemaining(daysRemaining, isExpired)}</span>
      {isIdle ? <span className={styles.idle}>Session idle</span> : null}
    </div>
  );
}
