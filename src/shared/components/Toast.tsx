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
