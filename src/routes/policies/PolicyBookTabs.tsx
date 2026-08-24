/**
 * WHY THIS EXISTS:
 *   The tab strip above the policy book, plus the "Switching…" affordance that
 *   only a transition can provide. It is a presentational component — the
 *   `useTransition` call itself lives in `PoliciesPage`, which owns the `view`
 *   state the transition wraps — and takes `isPending` as a prop.
 *
 * CONCEPTS: C-02
 *
 * WITHOUT THIS:
 *   The pending flag has nowhere to be shown. That matters more than it
 *   sounds, because a transition deliberately leaves the *old* view on screen
 *   while the new one renders: from the user's side, clicking "Exposure by
 *   customer" and seeing the policy table stay exactly as it was is
 *   indistinguishable from the click not registering. The whole reason
 *   `useTransition` returns `isPending` alongside `startTransition` is that
 *   keeping stale content visible is only an improvement if something on
 *   screen admits it is stale. Without this strip the transition would make
 *   the app feel broken rather than smooth — the correct fix for which is not
 *   to drop the transition but to render the flag it hands you.
 */

import type { ReactElement } from 'react';
import styles from './PolicyBookTabs.module.css';

export type BookView = 'book' | 'exposure';

export const BOOK_VIEWS: readonly { id: BookView; label: string }[] = [
  { id: 'book', label: 'Policy list' },
  { id: 'exposure', label: 'Exposure by customer' },
];

export interface PolicyBookTabsProps {
  view: BookView;
  onSelect: (view: BookView) => void;
  isPending: boolean;
}

export function PolicyBookTabs({ view, onSelect, isPending }: PolicyBookTabsProps): ReactElement {
  return (
    <div className={styles.tabs} role="tablist" aria-label="Policy book views">
      {BOOK_VIEWS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={view === tab.id}
          className={view === tab.id ? styles.tabActive : styles.tab}
          onClick={() => onSelect(tab.id)}
        >
          {tab.label}
        </button>
      ))}
      <span
        className={isPending ? styles.pendingVisible : styles.pending}
        aria-live="polite"
      >
        {isPending ? 'Switching…' : ''}
      </span>
    </div>
  );
}
