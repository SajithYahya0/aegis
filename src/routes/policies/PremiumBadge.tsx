import { memo, type ReactElement } from 'react';
import { formatCurrency } from '../../shared/format';

export interface PremiumBadgeProps {
  amount: number;
}

function PremiumBadgeImpl({ amount }: PremiumBadgeProps): ReactElement {
  console.log('[render] PremiumBadge');
  return <span>{formatCurrency(amount)}</span>;
}

export const PremiumBadge = memo(
  PremiumBadgeImpl,
  (prev, next) => formatCurrency(prev.amount) === formatCurrency(next.amount),
);
