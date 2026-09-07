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
