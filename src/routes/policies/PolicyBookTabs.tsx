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
