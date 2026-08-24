/**
 * WHY THIS EXISTS:
 *   Renders the filtered policy table. Deliberately NOT memoised itself —
 *   only its `PolicyRow` children are — because this component's own job
 *   (mapping an array to `<PolicyRow>` elements) is cheap regardless of how
 *   often it runs; the expensive part is one level down, per row, which is
 *   exactly where `React.memo` is applied instead.
 *
 * CONCEPTS: W1-08, W1-09, W3-D2-07
 *
 * WITHOUT THIS:
 *   No early return for the empty case: an empty `<tbody>` under a full
 *   `<thead>` renders a table that looks broken rather than a clear "no
 *   matches" message — an agent who has over-filtered has no way to tell
 *   from a blank table whether the filters or the app are at fault.
 */

import type { ReactElement } from 'react';
import type { PremiumBreakdown } from '../../shared/rating';
import type { Customer, Policy } from '../../shared/types';
import { PolicyRow } from './PolicyRow';
import styles from './PolicyList.module.css';

export interface PolicyListProps {
  policies: readonly Policy[];
  customersById: ReadonlyMap<string, Customer>;
  premiumsById: ReadonlyMap<string, PremiumBreakdown>;
  onSelect: (policyId: string) => void;
  isStale: boolean;
}

export function PolicyList({
  policies,
  customersById,
  premiumsById,
  onSelect,
  isStale,
}: PolicyListProps): ReactElement {
  if (policies.length === 0) {
    return <p className={styles.empty}>No policies match your filters.</p>;
  }

  return (
    <table className={isStale ? styles.stale : undefined}>
      <thead>
        <tr>
          <th>Policy</th>
          <th>Customer</th>
          <th>Type</th>
          <th>Status</th>
          <th>Sum insured</th>
          <th>Premium</th>
        </tr>
      </thead>
      <tbody>
        {policies.map((policy) => (
          <PolicyRow
            key={policy.id}
            policy={policy}
            customerName={customersById.get(policy.customerId)?.name ?? '—'}
            premium={premiumsById.get(policy.id)}
            onSelect={onSelect}
          />
        ))}
      </tbody>
    </table>
  );
}
