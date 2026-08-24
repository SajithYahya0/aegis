/**
 * WHY THIS EXISTS:
 *   The `useEffect` + `AbortController` counterpart to `api.ts`'s cached-promise
 *   `use()` path. Given a fetcher and a dependency list, it fetches once per
 *   dependency change, exposes `{ data, error, loading }`, and aborts whatever
 *   is still in flight the moment the deps change again or the caller unmounts.
 *   The Claims tab is the one consumer this phase adds, but the hook is generic
 *   — nothing about it is specific to claims.
 *
 * CONCEPTS: W2-D1-01, W2-D1-02, W2-D1-03, W3-D2-04
 *
 * WITHOUT THIS:
 *   One effect here earns three matrix rows, and that is worth defending
 *   rather than leaving unexplained: "mount-only fetch" (W2-D1-01) and
 *   "dependency-driven refetch" (W2-D1-02) sound like they need two different
 *   effects — one with `[]`, one with `[id]`. They do not. On the Claims
 *   tab's first render, an effect with `[policyId]` in its deps runs exactly
 *   once, which *is* the mount-only case; the interesting behaviour is what
 *   happens next, when `policyId` changes without the component unmounting
 *   (React Router reuses the same `PolicyClaimsTab` instance across
 *   `/policies/POL-1/claims` → `/policies/POL-2/claims`, it does not remount
 *   it). Hand-writing a second hook with a literal `[]` purely to tick the
 *   W2-D1-01 box would fetch once and then silently keep showing POL-1's
 *   claims forever — the exact bug this hook exists to prevent, shipped on
 *   purpose to satisfy a checklist. That is a worse outcome than the matrix
 *   row staying honestly unclaimed.
 *
 *   No `AbortController`: click POL-1 then POL-2 before the first request
 *   lands and both are in flight at once. Whichever settles second wins,
 *   with no relationship to which one the URL now says — half the time
 *   that's POL-1's claims rendered under POL-2's heading. Aborting the
 *   previous request in the cleanup (which runs before the effect re-fires,
 *   and also on unmount) is what stops the stale one from ever resolving
 *   into state.
 *
 *   No loading/error split: a fetch that is still pending looks identical to
 *   one that returned zero claims — both render nothing — so a slow network
 *   is indistinguishable from "this policy really has no claims" until the
 *   data (or lack of it) finally shows up.
 */

import { useEffect, useRef, useState } from 'react';

export interface FetchState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

export function useFetch<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
): FetchState<T> {
  // The fetcher closure is a fresh function every render (it usually closes
  // over props like `policyId`). Stashing the latest one in a ref lets the
  // effect below call `fetcherRef.current` without needing `fetcher` itself
  // in its dependency array — which matters, because `deps` is what the
  // *caller* controls to mean "these are the inputs that should trigger a
  // refetch", and folding an unstable function reference into that list
  // would refetch on every render regardless of what the caller passed.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const [state, setState] = useState<FetchState<T>>({ data: null, error: null, loading: true });

  useEffect(() => {
    const controller = new AbortController();
    setState({ data: null, error: null, loading: true });

    fetcherRef
      .current(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setState({ data, error: null, loading: false });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          data: null,
          error: error instanceof Error ? error : new Error(String(error)),
          loading: false,
        });
      });

    return () => {
      console.log('[useFetch] cleanup — aborting in-flight request');
      controller.abort();
    };
    // `deps` is caller-supplied and intentionally the only trigger for a
    // refetch — see the header for why `fetcherRef` sidesteps the need to
    // list `fetcher` here too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
