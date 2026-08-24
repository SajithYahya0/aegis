/**
 * WHY THIS EXISTS:
 *   The one-line "N of M policies" summary above the table, including the
 *   "Updating…" state while `usePolicyFilters`' deferred value is still
 *   catching up to what was typed.
 *
 * CONCEPTS: W3-D1-06
 *
 * WITHOUT THIS:
 *   Nothing tells the agent that the dimmed table below is deliberately
 *   stale rather than just frozen — the useDeferredValue split (C-03) would
 *   be invisible without something on screen that flips the instant a
 *   keystroke lands.
 *
 * WHY THIS IS DELIBERATELY *NOT* MEMOISED (W3-D1-06):
 *   `resultCount` and `isStale` are both derived from `rawQuery`, the one
 *   piece of state in `usePolicyFilters` that changes on *every* keystroke.
 *   That means this component's props are new on every render that could
 *   possibly reach it — a `React.memo` comparator here would run once per
 *   keystroke, always report "props changed", and re-render anyway. It
 *   would be strictly more work than not memoising: the cost of the
 *   comparison plus the cost of the render it could never actually skip.
 *   Contrast with `PolicyRow` (W3-D1-01), whose props stay referentially
 *   identical between keystrokes precisely because they come from the
 *   *deferred* value instead. The companion write-up for this contrast
 *   belongs in docs/failure-modes.md, which Phase 5 owns (see
 *   docs/phase-prompts.md) — this header is the source of truth until then.
 */

import type { ReactElement } from 'react';

export interface FilterStatusProps {
  resultCount: number;
  totalCount: number;
  isStale: boolean;
}

export function FilterStatus({ resultCount, totalCount, isStale }: FilterStatusProps): ReactElement {
  console.log('[render] FilterStatus');

  return (
    <p>
      {isStale ? (
        <>Updating…</>
      ) : (
        <>
          {resultCount} of {totalCount} policies
        </>
      )}
    </p>
  );
}
