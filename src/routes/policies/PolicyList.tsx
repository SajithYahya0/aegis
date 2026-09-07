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
