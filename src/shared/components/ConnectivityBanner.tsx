/**
 * WHY THIS EXISTS:
 *   The visible half of `useOnlineStatus`. Mounted once in `AppLayout`, so it
 *   is reachable from every route — connectivity is not a per-page concern,
 *   the whole console stops being able to reach `api.ts`'s simulated backend
 *   at the same moment.
 *
 * CONCEPTS: C-04
 *
 * WITHOUT THIS:
 *   `useOnlineStatus` would export a hook nothing in the app calls, and
 *   `useSyncExternalStore` (C-04) would have no on-screen proof that it
 *   actually resubscribes when the browser fires `offline` — a reviewer would
 *   have to read the hook's source and take the subscription on faith rather
 *   than toggling DevTools' network throttling and watching this banner
 *   appear.
 */

import type { ReactElement } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import styles from './ConnectivityBanner.module.css';

export function ConnectivityBanner(): ReactElement | null {
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <div className={styles.banner} role="status">
      You are offline. Changes made now — a logged claim, a saved quote draft — will not reach the
      server until the connection returns.
    </div>
  );
}
