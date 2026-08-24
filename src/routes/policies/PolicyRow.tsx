/**
 * WHY THIS EXISTS:
 *   One row of the policy table. Wrapped in `React.memo` because the book is
 *   140 policies deep and, without it, every keystroke that reaches this far
 *   down the tree would re-render — and re-log — all of them instead of
 *   only the ones whose data actually changed.
 *
 * CONCEPTS: W3-D1-01, W1-03, W1-12
 *
 * WITHOUT THIS:
 *   No `React.memo`: `PoliciesPage` re-renders on every keystroke (the raw
 *   search text lives in `usePolicyFilters`), and `PolicyList` re-renders
 *   with it. Without memoisation every row component would re-execute on
 *   that same keystroke even though its own props — `policy`, `premium`,
 *   `onSelect` — have not changed, and the `[render] PolicyRow` log would
 *   print once per row per keystroke with no way to tell from the console
 *   which rows actually changed.
 *
 *   No composed status class: a plain `className={\`status-${policy.status}\`}`
 *   string is invisible to CSS Modules' scoping — it either collides with an
 *   unrelated global class of the same name or resolves to nothing, and the
 *   badge renders with no colour at all. Every status looking identical is
 *   exactly the failure a status badge exists to prevent.
 */

import { memo, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency, POLICY_STATUS_LABEL, POLICY_TYPE_LABEL } from '../../shared/format';
import type { PremiumBreakdown } from '../../shared/rating';
import type { Policy, PolicyStatus } from '../../shared/types';
import { PremiumBadge } from './PremiumBadge';
import styles from './PolicyRow.module.css';

const STATUS_CLASS: Record<PolicyStatus, string> = {
  active: styles.statusActive,
  pending: styles.statusPending,
  lapsed: styles.statusLapsed,
  cancelled: styles.statusCancelled,
};

export interface PolicyRowProps {
  policy: Policy;
  customerName: string;
  premium: PremiumBreakdown | undefined;
  onSelect: (policyId: string) => void;
}

function PolicyRowImpl({ policy, customerName, premium, onSelect }: PolicyRowProps): ReactElement {
  console.log('[render] PolicyRow', policy.id);

  return (
    <tr>
      <td>
        <Link to={`/policies/${policy.id}`} onClick={() => onSelect(policy.id)}>
          {policy.id}
        </Link>
      </td>
      <td>{customerName}</td>
      <td>{POLICY_TYPE_LABEL[policy.type]}</td>
      <td>
        <span className={STATUS_CLASS[policy.status]}>{POLICY_STATUS_LABEL[policy.status]}</span>
      </td>
      <td>{formatCurrency(policy.sumInsured)}</td>
      <td>{premium ? <PremiumBadge amount={premium.annualPremium} /> : '—'}</td>
    </tr>
  );
}

export const PolicyRow = memo(PolicyRowImpl);
