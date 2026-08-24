/**
 * WHY THIS EXISTS:
 *   A short list of policies the agent has opened recently from /policies,
 *   persisted via `useLocalStorage` so it survives a reload or a StackBlitz
 *   dev-server restart, unlike plain component state.
 *
 * CONCEPTS: W1-08
 *
 * WITHOUT THIS:
 *   The list would live in `useState` inside `PoliciesPage` and reset to
 *   empty on every reload — the exact "was just looking at these three
 *   policies" context it exists to preserve would be gone the moment the
 *   agent's browser tab refreshes.
 */

import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { policiesById } from '../../shared/data';
import styles from './RecentlyViewed.module.css';

export interface RecentlyViewedProps {
  policyIds: readonly string[];
}

export function RecentlyViewed({ policyIds }: RecentlyViewedProps): ReactElement {
  return (
    <ul className={styles.list}>
      {policyIds.map((id) => {
        const policy = policiesById.get(id);
        return (
          <li key={id}>
            <Link to={`/policies/${id}`}>{id}</Link>
            {policy ? ` — ${policy.type}` : null}
          </li>
        );
      })}
    </ul>
  );
}
