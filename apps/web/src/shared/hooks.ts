import {
  useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction,
} from 'react';

export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStored<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}

export function useLocalStorage<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readStored(key, initialValue));
  const latest = useRef(value);

  const store = useCallback<Dispatch<SetStateAction<T>>>(
    (update) => {
      const next =
        typeof update === 'function' ? (update as (previous: T) => T)(latest.current) : update;
      latest.current = next;
      writeStored(key, next);
      setValue(next);
    },
    [key],
  );

  return [value, store];
}
