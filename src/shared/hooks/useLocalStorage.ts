/**
 * WHY THIS EXISTS:
 *   A `useState` that reads its initial value from `localStorage` once and
 *   writes every update back. Generic over `T` so it works for the
 *   recently-viewed policy list on /policies today and any future
 *   session-local preference.
 *
 * CONCEPTS: W3-D2-02, W1-07, C-08
 *
 * WITHOUT THIS:
 *   No lazy init: reading `localStorage.getItem(key)` directly as the
 *   `useState` initial *argument* (rather than the lazy `() => …` form) runs
 *   that read on every render, not just mount — a synchronous
 *   `localStorage` call and a `JSON.parse` on every keystroke in the search
 *   box, for a value that is only ever needed once.
 *
 *   No JSON safety: a value written by an older version of this hook, or
 *   corrupted by a browser extension, throws inside `JSON.parse` with no
 *   `try/catch` — and since that call happens during the initial render, it
 *   crashes the whole page rather than just resetting one preference.
 *
 *   No `useDebugValue`: React DevTools shows this hook as an anonymous
 *   "State" entry no matter how many `useLocalStorage` calls a component
 *   makes, so telling apart "recently viewed" from some other persisted
 *   value means reading values one by one, not labels.
 */

import { useDebugValue, useEffect, useState, type Dispatch, type SetStateAction } from 'react';

function readStorage<T>(key: string, initialValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : initialValue;
  } catch {
    return initialValue;
  }
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readStorage(key, initialValue));

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or disabled (private browsing): state still works
      // in-memory for the rest of the session, it just will not survive a
      // reload.
    }
  }, [key, value]);

  useDebugValue(value, (v) => `${key}: ${JSON.stringify(v)?.slice(0, 60)}`);

  return [value, setValue];
}
