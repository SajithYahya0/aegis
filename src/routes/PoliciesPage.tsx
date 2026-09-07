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
