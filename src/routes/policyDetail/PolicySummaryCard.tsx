/**
 * WHY THIS EXISTS:
 *   The header block on `/policies/:id`, and the app's one demonstration of
 *   reading data with `use()` instead of `useEffect`. It calls
 *   `getPolicyResource(id)` during render and unwraps the promise directly;
 *   there is no `loading` state, no `error` state and no `useState` holding
 *   the result, because the `<Suspense>` and `<ErrorBoundary>` around it in
 *   `PolicyDetailPage` own both of those.
 *
 *   It is also where `use()` reads Context inside a conditional branch — the
 *   thing `useContext` cannot do.
 *
 * CONCEPTS: W3-D5-01, W3-D5-02, W3-D5-03
 *
 * WITHOUT THIS:
 *   Three separate failures, one per thing this file proves.
 *
 *   1. No `use()` — the `useFetch` shape instead. That is the pattern
 *   `PolicyClaimsTab` still uses, deliberately, so the two sit side by side on
 *   the same page and can be compared. The cost of that shape is three states
 *   this component does not have: `data | null`, `loading`, `error`. Every
 *   consumer has to branch on all three, the first render always returns the
 *   empty one, and `data` is typed nullable forever even though by the time
 *   anything is drawn it never is. Here `detail` is `PolicyDetail`, full stop —
 *   a render that reaches line one already has the data, because a render that
 *   did not have it never got past `use()`.
 *
 *   2. No promise cache behind `getPolicyResource` — the infinite fetch loop.
 *   This is the failure mode that makes `use()` dangerous rather than merely
 *   different, and it is worth stating precisely. `use(fetchPolicy(id))` calls
 *   `fetchPolicy` *during render*. React suspends on the returned promise;
 *   when it settles React re-renders; the render body runs again; `fetchPolicy`
 *   is called again; a brand-new promise is thrown; React suspends again. The
 *   component never commits and the network tab fills up forever. `use()` is
 *   only safe against a promise whose identity is stable across renders, which
 *   is exactly what `api.ts`'s Map provides.
 *
 *   The console is the proof, and it does not need a special demo to see:
 *   `[api] → GET /policies/POL-00007/detail` prints exactly once per policy
 *   per session, while `[render] PolicySummaryCard` and `[api] ⤳ cache hit`
 *   print together on every re-render — clicking between the Coverage, Claims
 *   and Documents tabs, or toggling the technical breakdown below. Renders
 *   climb, real requests do not. One `→` line, many `⤳` lines: that is the
 *   cache working. If the cache were removed, every `⤳` would be a `→`.
 *
 *   3. No `use(AuthContext)` in the branch — `useAuth()` at the top instead.
 *   This is the one place the difference is load-bearing rather than stylistic.
 *   `useAuth` wraps `useContext`, so it obeys the rules of hooks: it must be
 *   called unconditionally, on every render, before any branch. That registers
 *   this fiber as an auth consumer *permanently* — so flipping the role in the
 *   header re-renders this card for every policy in the book, including the
 *   ~85% whose status is `active` and which therefore never render the
 *   reinstatement note that the role actually affects. `use()` has no such
 *   rule. Called inside the `if`, it registers the context dependency only on
 *   renders that actually take the branch, so an active policy's card is not
 *   subscribed to auth at all and a role switch does not touch it.
 *
 *   The rule `use()` still obeys: it must be called from a component or hook
 *   during render, and it cannot be called after the component has returned.
 *   Conditional is fine; asynchronous is not.
 */

import { use, useState, type ReactElement } from 'react';
import { getPolicyResource } from '../../shared/api';
import { formatCurrency, formatDate, POLICY_STATUS_LABEL, POLICY_TYPE_LABEL } from '../../shared/format';
import { AuthContext } from '../../shared/store/AuthContext';
import styles from './PolicySummaryCard.module.css';

export interface PolicySummaryCardProps {
  policyId: string;
}

export function PolicySummaryCard({ policyId }: PolicySummaryCardProps): ReactElement {
  /*
   * Called during render, every render. The cache is what makes that safe —
   * see this file's header. Note that `detail` is not nullable: reaching this
   * line means the promise is already fulfilled.
   */
  const detail = use(getPolicyResource(policyId));

  const [showBreakdown, setShowBreakdown] = useState(false);

  // Renders climb every time this logs; `[api] →` does not. That gap is the
  // point — see (2) in the header.
  console.log('[render] PolicySummaryCard', policyId);

  const { policy, customer, claims, documents } = detail;

  /*
   * W3-D5-03. The conditional context read. A lapsed or cancelled policy shows
   * a reinstatement note whose wording depends on who is looking; an active
   * policy shows nothing here and never reads auth at all.
   *
   * `use()` returns the context value the same way `useContext` would,
   * including the `null` default — this component sits under `AuthProvider`
   * via `App.tsx`, so the fallback branch is defensive rather than expected.
   */
  let reinstatement: string | null = null;
  if (policy.status === 'lapsed' || policy.status === 'cancelled') {
    const auth = use(AuthContext);
    reinstatement =
      auth?.role === 'underwriter'
        ? `Reinstatement is within your authority — ${customer.name} has ${claims.length} claim(s) on file.`
        : 'Reinstatement requires underwriter approval. Refer this policy before quoting.';
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.heading}>
        {customer.name} · {POLICY_TYPE_LABEL[policy.type]}
      </h2>

      <div className={styles.grid}>
        <Field label="Status" value={POLICY_STATUS_LABEL[policy.status]} />
        <Field label="Sum insured" value={formatCurrency(policy.sumInsured)} />
        <Field label="Cover from" value={formatDate(policy.startDate)} />
        <Field label="Cover to" value={formatDate(policy.endDate)} />
        <Field label="Claims filed" value={String(claims.length)} />
        <Field label="Documents" value={String(documents.length)} />
      </div>

      {reinstatement ? <p className={styles.reinstatement}>{reinstatement}</p> : null}

      {/*
        Exists to make (2) above clickable: every toggle re-renders this
        component, so the console gains a `[render]` + `⤳ cache hit` pair and
        no new `[api] →` line.
      */}
      <button
        type="button"
        className={styles.disclosure}
        aria-expanded={showBreakdown}
        onClick={() => setShowBreakdown((prev) => !prev)}
      >
        {showBreakdown ? 'Hide' : 'Show'} cover detail
      </button>

      {showBreakdown ? (
        <div className={styles.breakdown}>
          {policy.coverages.length} coverage line(s), aggregate limit{' '}
          {formatCurrency(policy.coverages.reduce((total, cover) => total + cover.limit, 0))}. Customer
          since {formatDate(customer.customerSince)}.
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className={styles.field}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
    </div>
  );
}
