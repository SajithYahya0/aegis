/**
 * WHY THIS EXISTS:
 *   Delays reacting to a fast-changing value until it stops changing for
 *   `delayMs`. `usePolicyFilters` uses it to decide when the free-text
 *   search is "settled" enough to write into the URL, instead of writing on
 *   every keystroke.
 *
 * CONCEPTS: W3-D2-03
 *
 * WITHOUT THIS:
 *   Every keystroke in the /policies search box would call `setSearchParams`
 *   immediately. Each call replaces the current history entry, so the URL
 *   bar — and anything reading it, like a "copy link" clicked mid-type —
 *   would show a half-typed query string, "acc" instead of "accident
 *   claim", for as long as the agent is still typing. Debouncing means the
 *   URL only updates once the agent pauses.
 */

import { useEffect, useState } from 'react';

export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
