/**
 * WHY THIS EXISTS:
 *   The presentational half of the renewal countdown on `/policies/:id` — all
 *   the interval/ref machinery lives in `useRenewalCountdown`, this component
 *   just renders what it returns and shows the idle-session flag alongside
 *   it, since both come from the same hook and the same underlying interval.
 *
 *   It renders **days only**. The hook still returns hours/minutes/seconds,
 *   but policies renew years out, so a full `3962d 13h 11m 13s` readout is a
 *   wall of digits where three of the four fields are never the reason anyone
 *   looked at the bar.
 *
 * CONCEPTS: (consumer of useRenewalCountdown — see that hook for W2-D1-04, W2-D2-02)
 *
 * WITHOUT THIS:
 *   `useRenewalCountdown` would export a hook nothing in the app calls, and
 *   "renewal countdown timer teardown" (W2-D1-04) would have no mount/unmount
 *   cycle to actually exercise — the interval would only ever be provable by
 *   reading the hook's source, not by watching it start and stop as the
 *   agent navigates to and away from a policy.
 */

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
