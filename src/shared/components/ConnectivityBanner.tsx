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
