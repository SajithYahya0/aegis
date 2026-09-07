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
