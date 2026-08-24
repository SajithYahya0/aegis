/**
 * WHY THIS EXISTS:
 *   A dialog rendered outside `#root`, with an imperative `open()` / `close()`
 *   / `focusFirst()` surface instead of a boolean prop, because the callers
 *   that need it — "log a claim" today — trigger it from a click handler and
 *   have no reason to hold the open/closed flag in their own state just to
 *   pass it down.
 *
 * CONCEPTS: W2-D2-01, W3-D4-05, W3-D4-06, C-09
 *
 * WITHOUT THIS:
 *   No `createPortal` to `#modal-root`: mounted inside whatever panel opened
 *   it, the overlay's `position: fixed` is trapped by the first ancestor
 *   with a `transform` (`Panel` and the sticky premium summary both set one)
 *   — a fixed-position box inside a transformed ancestor positions relative
 *   to *that ancestor*, not the viewport, so the dialog would render pinned
 *   to a corner of the triggering card instead of centred over the page.
 *   `#modal-root` is a sibling of `#root` specifically so no ancestor's
 *   layout can ever own the modal's containing block — see `index.html`.
 *
 *   No focus trap: pressing Tab from the last field inside the dialog moves
 *   focus onto whatever is next in the *page's* tab order — a sidebar link
 *   behind an overlay the user cannot currently see past. The dialog would
 *   look modal but not behave modal.
 *
 *   No restore-on-close: closing the dialog leaves focus wherever it was
 *   left inside the (now-unmounted) portal content, which browsers resolve
 *   by silently moving focus to `<body>`. A keyboard user who opened the
 *   dialog from "Log claim" loses their place in the page entirely instead
 *   of landing back on the button they pressed.
 *
 *   No `useImperativeHandle`: the only alternative surface for "open this
 *   from a click elsewhere" is a boolean prop threaded down from a parent
 *   `useState`, which means every trigger site duplicates the same
 *   open/close state a `ModalHandle` ref exists to encapsulate once, here.
 */

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
  children: ReactNode;
}

export const Modal = forwardRef<ModalHandle, ModalProps>(function Modal(
  { labelledBy, children },
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
        className={styles.dialog}
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
