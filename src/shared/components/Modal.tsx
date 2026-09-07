import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import styles from './Modal.module.css';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalHandle {
  open: () => void;
  close: () => void;
  focusFirst: () => void;
}

export interface ModalProps {
  labelledBy: string;
  /**
   * Widens `max-width` from 420px to 640px. Opt-in per call site rather than
   * a global bump, because 420 is right for every consumer except the claim
   * intake wizard — see this file's header.
   */
  size?: 'default' | 'wide';
  children: ReactNode;
}

export const Modal = forwardRef<ModalHandle, ModalProps>(function Modal(
  { labelledBy, size = 'default', children },
  ref,
) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  function getFocusable(): HTMLElement[] {
    if (!containerRef.current) return [];
    return Array.from(containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  }

  function focusFirst(): void {
    getFocusable()[0]?.focus();
  }

  useImperativeHandle(
    ref,
    () => ({
      open: () => {
        previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
        setIsOpen(true);
      },
      close: () => setIsOpen(false),
      focusFirst,
    }),
    [],
  );

  // Focus the first field once the portal's content is in the DOM, and hand
  // focus back to whatever triggered `open()` when the dialog goes away —
  // including on unmount, not just an explicit `close()`.
  useEffect(() => {
    if (!isOpen) return;
    focusFirst();
    return () => {
      previouslyFocusedRef.current?.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setIsOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return null;

  return createPortal(
    <div className={styles.overlay} onMouseDown={() => setIsOpen(false)}>
      <div
        ref={containerRef}
        className={size === 'wide' ? styles.dialogWide : styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    modalRoot,
  );
});
