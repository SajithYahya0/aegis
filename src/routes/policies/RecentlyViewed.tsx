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
