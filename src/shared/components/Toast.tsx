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
 */

import { useEffect, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import styles from './Toast.module.css';

const AUTO_DISMISS_MS = 4000;

export interface ToastProps {
  message: string;
  onDismiss: () => void;
}

export function Toast({ message, onDismiss }: ToastProps): ReactElement | null {
  useEffect(() => {
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return null;

  return createPortal(
    <div className={styles.toast} role="status">
      {message}
    </div>,
    modalRoot,
  );
}
