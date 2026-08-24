/**
 * WHY THIS EXISTS:
 *   The controlled filter controls for /policies: free-text search, status,
 *   type, and an "expiring soon" toggle. Every input's value comes from
 *   `usePolicyFilters` and every change goes through its setters — nothing
 *   here holds its own copy of the filter state.
 *
 * CONCEPTS: W1-10, W1-11
 *
 * WITHOUT THIS:
 *   An uncontrolled `<input defaultValue=...>` would only ever show what the
 *   agent typed in *this* mount. Deep-linking to `/policies?status=lapsed`,
 *   or navigating back from a policy opened via "Recently viewed", would
 *   leave the status dropdown showing "All statuses" while the table
 *   underneath is actually filtered — the visible controls and the applied
 *   filter would disagree with each other.
 */

import type { ChangeEvent, ReactElement } from 'react';
import { POLICY_STATUS_LABEL, POLICY_TYPE_LABEL } from '../../shared/format';
import type { PolicyStatus, PolicyType } from '../../shared/types';
import styles from './PolicyFilterBar.module.css';

const STATUSES: readonly PolicyStatus[] = ['active', 'pending', 'lapsed', 'cancelled'];
const TYPES: readonly PolicyType[] = ['motor', 'health', 'property', 'life'];

export interface PolicyFilterBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  status: PolicyStatus | '';
  onStatusChange: (value: PolicyStatus | '') => void;
  type: PolicyType | '';
  onTypeChange: (value: PolicyType | '') => void;
  expiringWithin: boolean;
  onExpiringWithinChange: (value: boolean) => void;
}

export function PolicyFilterBar({
  query,
  onQueryChange,
  status,
  onStatusChange,
  type,
  onTypeChange,
  expiringWithin,
  onExpiringWithinChange,
}: PolicyFilterBarProps): ReactElement {
  return (
    <div className={styles.bar}>
      <input
        type="search"
        className={styles.search}
        placeholder="Search policy id or customer name"
        value={query}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onQueryChange(event.target.value)}
      />

      <select
        value={status}
        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
          onStatusChange(event.target.value as PolicyStatus | '')
        }
      >
        <option value="">All statuses</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {POLICY_STATUS_LABEL[s]}
          </option>
        ))}
      </select>

      <select
        value={type}
        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
          onTypeChange(event.target.value as PolicyType | '')
        }
      >
        <option value="">All types</option>
        {TYPES.map((t) => (
          <option key={t} value={t}>
            {POLICY_TYPE_LABEL[t]}
          </option>
        ))}
      </select>

      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={expiringWithin}
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onExpiringWithinChange(event.target.checked)
          }
        />
        Expiring within 30 days
      </label>
    </div>
  );
}
