/**
 * WHY THIS EXISTS:
 *   The hook-composition example: owns every piece of /policies' filter
 *   state and turns it into the array `PoliciesPage` actually renders. It
 *   composes three other hooks rather than being one component — the URL
 *   (`useSearchParams`) as the source of truth, `useDebounce` so typing does
 *   not spam the history entry, `useDeferredValue` so the filtered list does
 *   not block the keystroke that produced it, and `useMemo` so the filter
 *   itself only re-runs when a committed input actually changed.
 *
 * CONCEPTS: W3-D2-05, C-03, C-11, W2-D4-07
 *
 * WITHOUT THIS:
 *   Composing these by hand inside `PoliciesPage` would work exactly once —
 *   the moment a second place needs the same filter logic (a "my branch's
 *   policies" widget on the dashboard, say), either it re-implements the
 *   same hooks and they drift apart, or `PoliciesPage` grows props it does
 *   not use just to share logic. A hook is the reusable unit; a route
 *   component is not.
 *
 *   No debounce on the URL write: every keystroke calls `setSearchParams`,
 *   so a link copied mid-type reads "acc" instead of what the agent meant.
 *
 *   No `useDeferredValue`: `filtered` would be derived straight from the
 *   urgent, every-keystroke `rawQuery`, so `PoliciesPage`'s
 *   `useMemo(rateBook(...))` (W3-D1-03) re-prices the visible book
 *   synchronously inside the same render that echoes the typed character —
 *   see `rating.ts`'s header for what that costs. Deferring `rawQuery` lets
 *   React paint the keystroke first and run the expensive re-filter at a
 *   lower priority.
 *
 *   No `startTransition` around the debounced URL commit: `setSearchParams`
 *   after the debounce timer fires is a state update that happens outside
 *   any input's own event handler (it runs from an effect once the timer
 *   lands). Marking it non-urgent keeps that commit from starving whatever
 *   render the user's next keystroke is waiting on.
 */

import { parseISO } from 'date-fns';
import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AS_OF, customersById, policies } from '../data';
import { daysUntil } from '../format';
import type { Policy, PolicyStatus, PolicyType } from '../types';
import { useDebounce } from './useDebounce';

/**
 * Exported because /dashboard's renewal table has to mean the same thing by
 * "expiring" as the `expiring=1` filter this hook applies — the dashboard row
 * links straight into that filtered list, so two different windows would show
 * the user a count of 9 and then a list of 14 with no explanation.
 */
export const EXPIRING_WINDOW_DAYS = 30;
const DEBOUNCE_MS = 300;

export interface PolicyFilters {
  rawQuery: string;
  setRawQuery: (value: string) => void;
  status: PolicyStatus | '';
  setStatus: (value: PolicyStatus | '') => void;
  type: PolicyType | '';
  setType: (value: PolicyType | '') => void;
  expiringWithin: boolean;
  setExpiringWithin: (value: boolean) => void;
  filtered: readonly Policy[];
  isStale: boolean;
  resultCount: number;
  totalCount: number;
}

export function usePolicyFilters(): PolicyFilters {
  const [searchParams, setSearchParams] = useSearchParams();

  const [rawQuery, setRawQuery] = useState(searchParams.get('q') ?? '');
  const debouncedQuery = useDebounce(rawQuery, DEBOUNCE_MS);
  const deferredQuery = useDeferredValue(rawQuery);

  const status = (searchParams.get('status') ?? '') as PolicyStatus | '';
  const type = (searchParams.get('type') ?? '') as PolicyType | '';
  const expiringWithin = searchParams.get('expiring') === '1';

  // The debounced URL commit is the standalone startTransition example
  // (C-11): it fires from this effect, not from an input's event handler,
  // so there is no `useTransition()` pending flag to wire up here — just a
  // non-urgent state update.
  useEffect(() => {
    startTransition(() => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (debouncedQuery) next.set('q', debouncedQuery);
          else next.delete('q');
          return next;
        },
        { replace: true },
      );
    });
  }, [debouncedQuery, setSearchParams]);

  function setParam(key: string, value: string | null): void {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  }

  const setStatus = (value: PolicyStatus | ''): void => setParam('status', value || null);
  const setType = (value: PolicyType | ''): void => setParam('type', value || null);
  const setExpiringWithin = (value: boolean): void => setParam('expiring', value ? '1' : null);

  const filtered = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();

    return policies.filter((policy) => {
      if (status && policy.status !== status) return false;
      if (type && policy.type !== type) return false;
      if (expiringWithin) {
        const days = daysUntil(policy.endDate, parseISO(AS_OF));
        if (days < 0 || days > EXPIRING_WINDOW_DAYS) return false;
      }
      if (needle) {
        const customerName = customersById.get(policy.customerId)?.name ?? '';
        const haystack = `${policy.id} ${customerName}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [deferredQuery, status, type, expiringWithin]);

  return {
    rawQuery,
    setRawQuery,
    status,
    setStatus,
    type,
    setType,
    expiringWithin,
    setExpiringWithin,
    filtered,
    isStale: rawQuery !== deferredQuery,
    resultCount: filtered.length,
    totalCount: policies.length,
  };
}
