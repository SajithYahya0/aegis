/**
 * WHY THIS EXISTS:
 *   The policy book: filter bar, a "recently viewed" widget, and the
 *   filtered, priced table. This is where the Week 3 performance story
 *   lives — `usePolicyFilters` composes the URL, debounce and
 *   deferred-value pieces, and this component turns the result into
 *   `React.memo` rows priced by a rating pass over the whole book.
 *
 * CONCEPTS: W1-13, W1-09, W1-14, W3-D1-03, W3-D1-05, W1-05, W1-06, C-02
 *
 * WITHOUT THIS:
 *   `premiums` is deliberately `rateBook(policies, customers, claims)` over
 *   the FULL book, memoised on `policies`/`customers`/`claims` — stable
 *   module-level singletons from `src/shared/data` that never change across
 *   the app's lifetime — not on `filtered`. An earlier version of this file
 *   called `rateBook(filtered, customers, claims)` instead, keyed on
 *   `filtered`. That looked reasonable ("why price policies nobody can
 *   see?") and was wrong twice over — a real bug found by watching the
 *   browser console, not a hypothetical:
 *
 *     (1) It made the "genuinely expensive" claim behind W3-D1-03 false.
 *     Typing a filter that narrows 140 policies down to 4 makes `rateBook`
 *     *cheaper*, not more necessary — the console read "rateBook 4 policies
 *     in 0.6ms" instead of pricing the full book, which inverts the entire
 *     point of memoising it.
 *
 *     (2) It defeated `PolicyRow`'s `React.memo` (W3-D1-01) for every row
 *     still on screen. `rateBook` returns a brand-new `Map` of brand-new
 *     `PremiumBreakdown` objects on every call — it never reuses an object
 *     for a policy it has already priced. Because `filtered`'s array
 *     reference changes on almost every keystroke (once the deferred value
 *     settles, or immediately for a status/type change), keying the memo on
 *     `filtered` meant `premiums` was recomputed on almost every keystroke
 *     too — so every row still visible received a *new* `premium` object
 *     even though its own policy had not changed. `React.memo`'s prop
 *     comparison correctly saw a changed prop and re-rendered: the memo
 *     looked broken (every visible row re-logged on every keystroke), but
 *     the actual defect was upstream — the identity of a prop the row
 *     depends on was churning for reasons that had nothing to do with that
 *     row's own data. `onSelect` (W3-D1-05) was checked and cleared:
 *     `handleSelect`'s `useCallback` deps (`[setRecentIds]`) are stable
 *     because `useLocalStorage` returns the raw `useState` setter, which
 *     React guarantees is stable for the life of the component.
 *
 *   Rating the full book once and looking premiums up by id fixes both: the
 *   log always reads "rateBook 140 policies in ~Nms" regardless of the
 *   filter, and a row whose policy is still in `filtered` gets back the
 *   *exact same* `PremiumBreakdown` object it had before, so its
 *   `React.memo` comparison — and `PremiumBadge`'s (W3-D1-02) one level
 *   deeper — actually passes instead of only appearing to.
 *
 *   No `useCallback` on `handleSelect`: `PolicyRow` would receive a new
 *   function identity every render of `PoliciesPage`, defeating its memo
 *   the same way the premiums bug did, just via a different prop.
 *
 *   No functional `setRecentIds(prev => ...)`: two policies opened in quick
 *   succession (StrictMode double-invokes this handler in dev) would both
 *   read the same stale `recentIds` snapshot and each write their own
 *   single-item list, so the second write silently overwrites the first
 *   instead of both ending up in the list.
 *
 *   No `useTransition` around the view switch (C-02): `setView` would be an
 *   urgent update, and urgent means React is not allowed to show anything
 *   until the resulting render is complete. Switching to "Exposure by
 *   customer" therefore has to unmount up to 140 memoised `PolicyRow`s and
 *   mount a fresh aggregate table in one uninterruptible block before the
 *   browser paints again. Anything the user does during that block waits for
 *   it — including a keystroke in the search box directly above, which is why
 *   the failure is visible rather than theoretical: type while the switch is
 *   in flight and the character appears late, in a burst, after the new table
 *   has rendered. The input is controlled, so the delay is in echoing the
 *   character the user already typed.
 *
 *   Marking the switch as a transition inverts the priority. React keeps the
 *   current view on screen and renders the next one in the background, and —
 *   the part that actually matters — that background render is
 *   *interruptible*: an urgent update like a keystroke pre-empts it, gets
 *   painted immediately, and the transition restarts. The switch may finish
 *   slightly later; the input never stops responding. `isPending` is what pays
 *   for keeping stale content on screen while that happens; see
 *   `PolicyBookTabs`.
 *
 *   Note the division of labour with `useDeferredValue` in `usePolicyFilters`
 *   (C-03), which is the same priority idea entered from the other end.
 *   `useDeferredValue` defers a *value* the component does not control the
 *   source of — the query text, which arrives from an input that must stay
 *   urgent. `useTransition` marks a *state update this component owns* as
 *   non-urgent. Here the tab click is ours to classify, so `useTransition` is
 *   the right one; a deferred `view` value would still leave `setView` itself
 *   urgent and fix nothing.
 */

import { useCallback, useMemo, useState, useTransition, type ReactElement } from 'react';
import { Panel } from '../shared/components/Panel';
import { claims, customers, customersById, policies } from '../shared/data';
import { useLocalStorage } from '../shared/hooks/useLocalStorage';
import { usePolicyFilters } from '../shared/hooks/usePolicyFilters';
import { rateBook } from '../shared/rating';
import { ExposureByCustomer } from './policies/ExposureByCustomer';
import { FilterStatus } from './policies/FilterStatus';
import { PolicyBookTabs, type BookView } from './policies/PolicyBookTabs';
import { PolicyFilterBar } from './policies/PolicyFilterBar';
import { PolicyList } from './policies/PolicyList';
import { RecentlyViewed } from './policies/RecentlyViewed';

const RECENTS_KEY = 'aegis:recent-policies';
const MAX_RECENTS = 5;

export default function PoliciesPage(): ReactElement {
  const {
    rawQuery,
    setRawQuery,
    status,
    setStatus,
    type,
    setType,
    expiringWithin,
    setExpiringWithin,
    filtered,
    isStale,
    resultCount,
    totalCount,
  } = usePolicyFilters();

  // W3-D1-03: rated over the WHOLE book and memoised on the book itself
  // (never on `filtered`) — see this file's header for the bug that shipped
  // when it was keyed on the filter instead. `PolicyList` looks premiums up
  // by id, so a narrower `filtered` array still returns the same objects.
  const premiums = useMemo(
    () => rateBook(policies, customers, claims),
    [policies, customers, claims],
  );

  const [view, setView] = useState<BookView>('book');
  const [isSwitchingView, startViewTransition] = useTransition();

  /*
   * C-02. The click that lands here is urgent; the render it causes is not.
   * `startViewTransition` is what tells React the difference — without it
   * React has no way to know that this particular `setState` is allowed to
   * take a while, because nothing about a `setState` call says so.
   */
  const handleViewChange = useCallback((next: BookView) => {
    startViewTransition(() => {
      setView(next);
    });
  }, []);

  const [recentIds, setRecentIds] = useLocalStorage<string[]>(RECENTS_KEY, []);

  const handleSelect = useCallback(
    (policyId: string) => {
      setRecentIds((prev) => [policyId, ...prev.filter((id) => id !== policyId)].slice(0, MAX_RECENTS));
    },
    [setRecentIds],
  );

  return (
    <div>
      <h1>Policies</h1>

      <Panel title="Filters">
        <PolicyFilterBar
          query={rawQuery}
          onQueryChange={setRawQuery}
          status={status}
          onStatusChange={setStatus}
          type={type}
          onTypeChange={setType}
          expiringWithin={expiringWithin}
          onExpiringWithinChange={setExpiringWithin}
        />
      </Panel>

      <FilterStatus resultCount={resultCount} totalCount={totalCount} isStale={isStale} />

      {recentIds.length > 0 && (
        <Panel title="Recently viewed">
          <RecentlyViewed policyIds={recentIds} />
        </Panel>
      )}

      <PolicyBookTabs view={view} onSelect={handleViewChange} isPending={isSwitchingView} />

      {view === 'book' ? (
        <PolicyList
          policies={filtered}
          customersById={customersById}
          premiumsById={premiums}
          onSelect={handleSelect}
          isStale={isStale}
        />
      ) : (
        <ExposureByCustomer
          policies={filtered}
          customersById={customersById}
          premiumsById={premiums}
          isStale={isStale}
        />
      )}
    </div>
  );
}
