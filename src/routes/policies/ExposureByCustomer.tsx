/**
 * WHY THIS EXISTS:
 *   The second view of the policy book: the same filtered policies rolled up
 *   per customer, so an agent can see aggregate exposure to one household
 *   rather than a flat list of contracts. It exists as a genuinely different
 *   render of the same data — a different component subtree, not a re-sort of
 *   the same rows — which is what makes switching to it cost enough for
 *   `useTransition` (C-02) to be worth its complexity.
 *
 * CONCEPTS: (the tab-switch cost this view creates is what C-02 covers — see
 *   PoliciesPage; W1-08 keys are per customer id here)
 *
 * WITHOUT THIS:
 *   The tab strip would have one tab, and `useTransition` in `PoliciesPage`
 *   would be wrapping a state change nothing observes — exactly the contrived
 *   usage CLAUDE.md rules out. A transition is only defensible if the render
 *   it defers is big enough to drop a frame, and "re-render the same table
 *   with the rows in a different order" is not.
 *
 *   The roll-up is memoised on `policies` and `premiumsById`: without that,
 *   the grouping pass would re-run on every keystroke that reaches this
 *   component, including the ones that only changed `rawQuery` and left
 *   `filtered` alone.
 */

import { useMemo, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency, formatPercent } from '../../shared/format';
import type { PremiumBreakdown } from '../../shared/rating';
import type { Customer, Policy } from '../../shared/types';
import styles from './ExposureByCustomer.module.css';

export interface ExposureByCustomerProps {
  policies: readonly Policy[];
  customersById: ReadonlyMap<string, Customer>;
  premiumsById: ReadonlyMap<string, PremiumBreakdown>;
  isStale: boolean;
}

interface CustomerExposure {
  customerId: string;
  customerName: string;
  policyCount: number;
  sumInsured: number;
  annualPremium: number;
  firstPolicyId: string;
}

export function ExposureByCustomer({
  policies,
  customersById,
  premiumsById,
  isStale,
}: ExposureByCustomerProps): ReactElement {
  const rows = useMemo(() => {
    console.log('[compute] ExposureByCustomer roll-up over', policies.length, 'policies');

    const byCustomer = new Map<string, CustomerExposure>();

    for (const policy of policies) {
      const existing = byCustomer.get(policy.customerId);
      const premium = premiumsById.get(policy.id)?.annualPremium ?? 0;

      if (existing) {
        existing.policyCount += 1;
        existing.sumInsured += policy.sumInsured;
        existing.annualPremium += premium;
      } else {
        byCustomer.set(policy.customerId, {
          customerId: policy.customerId,
          customerName: customersById.get(policy.customerId)?.name ?? '—',
          policyCount: 1,
          sumInsured: policy.sumInsured,
          annualPremium: premium,
          firstPolicyId: policy.id,
        });
      }
    }

    return [...byCustomer.values()].sort((a, b) => b.sumInsured - a.sumInsured);
  }, [policies, customersById, premiumsById]);

  if (rows.length === 0) {
    return <p className={styles.empty}>No policies match your filters.</p>;
  }

  return (
    <table className={isStale ? styles.stale : undefined}>
      <thead>
        <tr>
          <th>Customer</th>
          <th className={styles.numeric}>Policies</th>
          <th className={styles.numeric}>Sum insured</th>
          <th className={styles.numeric}>Annual premium</th>
          <th className={styles.numeric}>Rate on line</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.customerId}>
            <td>
              <Link to={`/policies/${row.firstPolicyId}`}>{row.customerName}</Link>
            </td>
            <td className={styles.numeric}>{row.policyCount}</td>
            <td className={styles.numeric}>{formatCurrency(row.sumInsured)}</td>
            <td className={styles.numeric}>{formatCurrency(row.annualPremium)}</td>
            <td className={styles.numeric}>
              {formatPercent(row.sumInsured > 0 ? row.annualPremium / row.sumInsured : 0)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
