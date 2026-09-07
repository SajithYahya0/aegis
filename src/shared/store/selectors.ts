import { createSelector } from '@reduxjs/toolkit';
import { claims, customers, customersById, policies } from '../data';
import { rateBook } from '../rating';
import type { Role, User } from '../types';
import type { RootState } from './index';

export const selectUser = (state: RootState): User => state.auth.user;

export const selectRole = (state: RootState): Role => state.auth.role;

export const selectIsUnderwriter = (state: RootState): boolean =>
  state.auth.role === 'underwriter';

export interface CustomerExposure {
  customerId: string;
  customerName: string;
  city: string;
  policyCount: number;
  sumInsured: number;
  annualPremium: number;
  /** Somewhere to link to — the customer has no page of their own. */
  firstPolicyId: string;
}

/**
 * Aggregate exposure per customer, scoped to what the signed-in user is
 * allowed to see: an underwriter prices the whole book, an agent sees the
 * customers written out of their own branch.
 *
 * The roll-up mirrors `src/routes/policies/ExposureByCustomer.tsx`, which does
 * the same grouping inside a `useMemo` over props. That one is memoised per
 * component instance; this one is memoised per *store*, which is the
 * difference the row is about — the cache survives `UnderwritingPage`
 * unmounting and remounting, so navigating away and back does not re-price the
 * book.
 */
export const selectExposureByCustomer = createSelector(
  [selectUser],
  (user): readonly CustomerExposure[] => {
    const scoped =
      user.role === 'underwriter'
        ? policies
        : policies.filter((policy) => customersById.get(policy.customerId)?.city === user.branch);

    console.log(
      `[compute] exposure roll-up for ${user.role} over ${scoped.length} policies`,
    );

    // The expensive half. `rateBook` prices every policy through the loss
    // distribution and logs its own elapsed ms — that line appearing is the
    // proof this result function ran rather than being served from the cache.
    const premiums = rateBook(scoped, customers, claims);

    const byCustomer = new Map<string, CustomerExposure>();

    for (const policy of scoped) {
      const premium = premiums.get(policy.id)?.annualPremium ?? 0;
      const existing = byCustomer.get(policy.customerId);

      if (existing) {
        existing.policyCount += 1;
        existing.sumInsured += policy.sumInsured;
        existing.annualPremium += premium;
        continue;
      }

      const customer = customersById.get(policy.customerId);
      byCustomer.set(policy.customerId, {
        customerId: policy.customerId,
        customerName: customer?.name ?? '—',
        city: customer?.city ?? '—',
        policyCount: 1,
        sumInsured: policy.sumInsured,
        annualPremium: premium,
        firstPolicyId: policy.id,
      });
    }

    return [...byCustomer.values()].sort((a, b) => b.sumInsured - a.sumInsured);
  },
);
