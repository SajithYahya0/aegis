/**
 * WHY THIS EXISTS:
 *   The header block on `/policies/:id`, and the app's one demonstration of
 *   reading data with `use()` instead of `useEffect`. It calls
 *   `getPolicyResource(id)` during render and unwraps the promise directly;
 *   there is no `loading` state, no `error` state and no `useState` holding
 *   the result, because the `<Suspense>` and `<ErrorBoundary>` around it in
 *   `PolicyDetailPage` own both of those.
 *
 * CONCEPTS: W3-D5-01, W3-D5-02
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
 *   3. THE ROLE READ, AND WHAT MOVING IT TO REDUX COST. This component used to
 *   read the role with `use(AuthContext)` *inside* the `lapsed`/`cancelled`
 *   branch below — the one thing `useContext` cannot do, since a hook must be
 *   called unconditionally on every render. The payoff was real: an active
 *   policy's card never registered as an auth consumer at all, so switching
 *   role in the AppBar did not touch it.
 *
 *   That is gone, and it is gone for a reason worth stating plainly rather
 *   than papering over. `AuthContext` no longer exists; the session is a Redux
 *   slice, and `useAppSelector` is a hook — it subscribes this fiber to the
 *   store on every render whether the branch is taken or not. Keeping the old
 *   trick would have meant keeping `AuthContext` alive as a second home for
 *   the role, which is precisely the two-sources-of-truth problem the
 *   migration removed. There is no conditional, *reactive* store read to
 *   replace it with: `use(ReactReduxContext)` inside the branch would compile
 *   and would return the store, but the store reference never changes, so the
 *   reinstatement note would be computed once and then go stale the moment the
 *   role was switched — a correctness bug traded for a render saving.
 *
 *   The render saving that was lost is one re-render, of one card, per role
 *   switch: only one `PolicySummaryCard` is ever mounted, because it is the
 *   header of a single `/policies/:id`. The conditional-`use()` mechanism it
 *   demonstrated, however, is not replaced anywhere — see W3-D5-03 in
 *   `docs/coverage-matrix.md`, which is recorded as an honest gap rather than
 *   rehomed onto a component invented to carry it.
 */

import { use, useState, type ReactElement } from 'react';
import { getPolicyResource } from '../../shared/api';
import { formatCurrency, formatDate, POLICY_STATUS_LABEL, POLICY_TYPE_LABEL } from '../../shared/format';
import { useAppSelector } from '../../shared/store';
import { selectIsUnderwriter } from '../../shared/store/selectors';
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

  /*
   * Unconditional, because a hook has to be. See (3) in the header for what
   * that costs and why the conditional `use(AuthContext)` it replaces could
   * not survive the move to Redux.
   */
  const isUnderwriter = useAppSelector(selectIsUnderwriter);

  const [showBreakdown, setShowBreakdown] = useState(false);

  // Renders climb every time this logs; `[api] →` does not. That gap is the
  // point — see (2) in the header.
  console.log('[render] PolicySummaryCard', policyId);

  const { policy, customer, claims, documents } = detail;

  /*
   * A lapsed or cancelled policy shows a reinstatement note whose wording
   * depends on who is looking. The branch is still a branch — an active policy
   * renders nothing here — but the role behind it is now read above, on every
   * render, rather than inside this `if`.
   */
  let reinstatement: string | null = null;
  if (policy.status === 'lapsed' || policy.status === 'cancelled') {
    reinstatement = isUnderwriter
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
