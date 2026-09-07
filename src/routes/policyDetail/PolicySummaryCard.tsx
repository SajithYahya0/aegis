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
