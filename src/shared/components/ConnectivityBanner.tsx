/**
 * WHY THIS EXISTS:
 *   The connectivity banner, mounted once in `AppLayout` so it is reachable
 *   from every route — connectivity is not a per-page concern, the whole
 *   console stops being able to reach `api.ts`'s simulated backend at the
 *   same moment.
 *
 *   It reads `navigator.onLine`, kept in sync with the browser's `online` /
 *   `offline` events via `useSyncExternalStore` — React's mechanism for
 *   subscribing to state that lives outside React entirely. `navigator` is not
 *   a prop, not context, not anything `useState` or `useEffect` owns; it is
 *   mutated by the browser itself, on its own schedule.
 *
 * CONCEPTS: C-04
 *
 * WITHOUT THIS:
 *   The tempting shortcut is `useState(navigator.onLine)` plus a `useEffect`
 *   that adds the two listeners and calls `setOnline`. That works, but it is
 *   exactly the shape `useSyncExternalStore` exists to replace: two effects'
 *   worth of subscribe/unsubscribe boilerplate reimplemented by hand, and —
 *   the part that actually matters under React 19's concurrent rendering — no
 *   guarantee that a render reading `navigator.onLine` directly and a render
 *   reading the `useState` mirror of it agree, if the network flips state
 *   between the two. `useSyncExternalStore` is what makes "the value this
 *   component rendered with" and "the value the store currently holds" the
 *   same guarantee React gives `useState` itself, for a store React does not
 *   own.
 *
 *   No `getServerSnapshot`: `useSyncExternalStore` throws during any
 *   server-rendered pass, because `navigator` does not exist on the server.
 *   AEGIS is client-only today, but the throw would happen during React's
 *   *hydration* check even so — React always asks for a server snapshot up
 *   front to decide whether client and server agree, and an unimplemented one
 *   is a hard error, not a silent fallback.
 *
 *   And without the banner itself, C-04 would have no on-screen proof that
 *   the subscription actually fires when the browser dispatches `offline` — a
 *   reviewer would have to read the source and take it on faith rather than
 *   toggling DevTools' network throttling and watching this banner appear.
 */

import { useSyncExternalStore, type ReactElement } from 'react';
import styles from './ConnectivityBanner.module.css';

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener('online', onStoreChange);
  window.addEventListener('offline', onStoreChange);
  return () => {
    window.removeEventListener('online', onStoreChange);
    window.removeEventListener('offline', onStoreChange);
  };
}

function getSnapshot(): boolean {
  return navigator.onLine;
}

/** No `navigator` on the server — assume online rather than throw. */
function getServerSnapshot(): boolean {
  return true;
}

export function ConnectivityBanner(): ReactElement | null {
  const online = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (online) return null;

  return (
    <div className={styles.banner} role="status">
      You are offline. Changes made now — a logged claim, a saved quote draft — will not reach the
      server until the connection returns.
    </div>
  );
}
