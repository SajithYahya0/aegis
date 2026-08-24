/**
 * WHY THIS EXISTS:
 *   The presentational half of the renewal countdown on `/policies/:id` — all
 *   the interval/ref machinery lives in `useRenewalCountdown`, this component
 *   just renders what it returns and shows the idle-session flag alongside
 *   it, since both come from the same hook and the same underlying interval.
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
import styles from './RenewalCountdown.module.css';

export interface RenewalCountdownProps {
  endDate: string;
}

export function RenewalCountdown({ endDate }: RenewalCountdownProps): ReactElement {
  const { daysRemaining, hoursRemaining, minutesRemaining, secondsRemaining, isExpired, isIdle } =
    useRenewalCountdown(endDate);

  return (
    <div className={styles.bar}>
      <span className={styles.label}>{isExpired ? 'Renewal overdue' : 'Renews in'}</span>
      <span className={styles.clock}>
        {String(daysRemaining).padStart(2, '0')}d{' '}
        {String(hoursRemaining).padStart(2, '0')}h{' '}
        {String(minutesRemaining).padStart(2, '0')}m{' '}
        {String(secondsRemaining).padStart(2, '0')}s
      </span>
      {isIdle ? <span className={styles.idle}>Session idle</span> : null}
    </div>
  );
}
