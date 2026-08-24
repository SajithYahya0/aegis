/**
 * WHY THIS EXISTS:
 *   A transient confirmation ("Claim CLM-XXXXXX logged") that shows after the
 *   quick claim form on the Claims tab succeeds. Portalled to the same
 *   `#modal-root` node as `Modal` — the index.html comment names both for a
 *   reason: a toast fired while the claim modal is still mid-close animation
 *   is exactly the case a component-subtree portal cannot handle cleanly,
 *   since it would be unmounted along with whatever triggered it.
 *
 * CONCEPTS: C-09
 *
 * WITHOUT THIS:
 *   Rendered inline instead of portalled, a toast fired from inside the
 *   claims table would inherit that table's `overflow` and stacking context.
 *   The dialog it is confirming (`Modal`) has already closed by the time the
 *   toast appears, but nothing else in `PolicyClaimsTab` establishes a
 *   `position: fixed`-safe containing block the way `#modal-root` does, so
 *   the toast would need its own escape hatch anyway — at which point it is
 *   just `Modal`'s portal target with extra steps.
 *
 *   `onDismiss` in the effect's dependency array — which is what shipped, and
 *   is the same identity-churn bug `PoliciesPage`'s header spends forty lines
 *   diagnosing for `premiums`, caught there and missed here. Both call sites
 *   pass an inline arrow (`onDismiss={() => setToastMessage(null)}`), so the
 *   prop is a new function on every render of the parent. A new identity in the
 *   deps means the effect tears down and re-runs on every parent render, which
 *   means `clearTimeout` followed by a fresh `setTimeout(4000)` — the countdown
 *   restarts from zero, every time. Any parent that re-renders more often than
 *   every four seconds produces a toast that never dismisses at all.
 *
 *   Neither parent currently re-renders on a timer, so today the bug is latent
 *   rather than visible. That is not a defence: `PolicyClaimsTab` is one
 *   `useFetch` poll or one added countdown away from the toast becoming
 *   permanent, and the failure would be attributed to the toast rather than to
 *   whatever started re-rendering.
 *
 *   Holding the callback in a ref and keying the effect on `message` alone
 *   states the real rule — "restart the countdown when the message changes" —
 *   instead of restarting it whenever an unrelated ancestor happens to render.
 *   The ref is read at fire time, so a parent that swaps its handler mid-flight
 *   still gets the current one called; this is the same pattern `useFetch` uses
 *   for the same reason, and it is why `onDismiss` must NOT be a dependency
 *   rather than merely need not be.
 */

import { useEffect, useRef, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import styles from './Toast.module.css';

const AUTO_DISMISS_MS = 4000;

export interface ToastProps {
  message: string;
  onDismiss: () => void;
}

export function Toast({ message, onDismiss }: ToastProps): ReactElement | null {
  // Latest handler, without letting its identity drive the timer. See header.
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    const timer = setTimeout(() => onDismissRef.current(), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [message]);

  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return null;

  return createPortal(
    <div className={styles.toast} role="status">
      {message}
    </div>,
    modalRoot,
  );
}
