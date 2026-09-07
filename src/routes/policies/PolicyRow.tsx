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
