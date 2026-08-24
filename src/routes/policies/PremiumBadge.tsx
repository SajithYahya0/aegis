/**
 * WHY THIS EXISTS:
 *   Renders one formatted premium. `React.memo`'s custom comparator compares
 *   the *formatted* string rather than the raw `amount`, so a premium that
 *   moves by a few paise between two `rateBook` runs — entirely possible
 *   given the convolution in `rating.ts` — does not re-render a badge whose
 *   displayed text would be identical either way.
 *
 * CONCEPTS: W3-D1-02
 *
 * WITHOUT THIS:
 *   The default `React.memo` shallow comparison checks `prev.amount ===
 *   next.amount` on the raw number. `rateBook` returns a fresh
 *   `Map<string, PremiumBreakdown>` every time it runs, so even a policy
 *   whose premium is bit-for-bit unchanged gets a *new* `PremiumBreakdown`
 *   object — and if two runs price it a paisa apart, plain equality
 *   re-renders a badge that displays "₹18,442" both times. That is the
 *   render this comparator exists to skip.
 */

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
