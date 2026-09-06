/**
 * WHY THIS EXISTS:
 *   The read side of the auth slice. Components ask these questions rather
 *   than reaching into `state.auth` themselves, so the shape of the slice is
 *   free to change without every consumer changing with it.
 *
 *   Two of the three are plain functions and one is a `createSelector`. That
 *   split is the point of the file, and it is deliberate in both directions —
 *   see below.
 *
 * CONCEPTS: W4-D4-04
 *
 * WITHOUT THIS — specifically, without `createSelector` on
 * `selectExposureByCustomer`:
 *   `useAppSelector` re-runs its selector after *every* dispatched action and
 *   keeps the result only if `Object.is(previous, next)` says it is the same
 *   value. An un-memoised roll-up returns a brand-new array of brand-new
 *   objects every single time it runs, so that check can never pass. Two
 *   things follow, and they compound:
 *
 *   1. The roll-up recomputes on every action. It is not a cheap one — it
 *   filters the book, then runs `rateBook` over the survivors, which is the
 *   same ~7M-iteration convolution `PoliciesPage` wraps in a `useMemo`
 *   (W3-D1-03) and which logs its own elapsed milliseconds. On this book that
 *   is ~350ms of main thread, and the actions that would trigger it are the
 *   ones nobody thinks of as state changes: `auth/login/pending`,
 *   `auth/login/fulfilled`, and every `auth/refresh/*` a 401 recovery fires.
 *   Opening /underwriting and letting the token expire once would re-price the
 *   whole book three more times.
 *
 *   2. `UnderwritingPage` re-renders on every action even when the exposure it
 *   is showing is identical, because the array identity changed. Nothing on
 *   screen differs; the whole table is rebuilt anyway.
 *
 *   With `createSelector`, the input — the current user — is compared instead.
 *   `DEMO_USERS[role]` is a module constant, so switching role hands the
 *   result function a genuinely different object and it recomputes exactly
 *   once; a login, a refresh, a status transition and a thrown error all leave
 *   that reference alone and the cached array is returned untouched. The
 *   `[compute]` line below is how that is checked from the console: it prints
 *   on a role switch and on nothing else.
 *
 *   WHY `selectRole` AND `selectIsUnderwriter` ARE **NOT** MEMOISED: they
 *   return a string and a boolean. Reference equality on a primitive *is*
 *   value equality, so `Object.is` already answers correctly and a memo cache
 *   in front of them would cost a closure and an array allocation to prevent
 *   nothing. This is the same argument `FilterStatus` makes for staying
 *   un-memoised (W3-D1-06); it applies here for the same reason and is worth
 *   stating, because "wrap every selector in createSelector" is the cargo-cult
 *   version of this file.
 */

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
