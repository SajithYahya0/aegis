/**
 * WHY THIS EXISTS:
 *   The route table, and nothing else. `BrowserRouter` lives in `main.tsx`.
 *   Every route element here is a `React.lazy` component from
 *   `shared/routes/lazyRoutes`, wrapped in its own `<Suspense>` and its own
 *   `<ErrorBoundary>`. There is still no boundary of either kind at the root
 *   of this file, deliberately.
 *
 * CONCEPTS: W2-D4-02, W2-D4-09, W3-D3-01, W3-D3-03, W3-D5-05
 *
 * WITHOUT THIS:
 *   There is no other place in the app that maps a URL to a component — this
 *   is that map. Without it every route's page component would need its own ad
 *   hoc mounting logic, and nested routes like `/policies/:id/claims` would
 *   have no parent to inherit their layout and `<Outlet>` from.
 *
 *   No per-route `<Suspense>`, one at the root instead: the fallback would
 *   replace *everything*, sidebar and header included, every time any chunk
 *   loads. Navigating from /policies to /quote would blank the nav the user
 *   just clicked, so for 300ms there is nothing on screen to go back to and no
 *   indication of which route is loading. Putting each boundary inside
 *   `AppLayout`'s `<Outlet>` means the chrome stays put and only the content
 *   region shows a skeleton — which is also why the fallbacks here are shaped
 *   like the page each one replaces rather than a generic spinner.
 *
 *   No per-*tab* `<Suspense>` under `/policies/:id`: the tab chunks resolve
 *   into the parent's `<Outlet>`, so with only the parent wrapped, the nearest
 *   boundary above a loading tab is the one around `PolicyDetailPage` itself.
 *   Clicking "Claims" would therefore unmount the policy header, the renewal
 *   countdown and the tab nav — including the link just clicked — and replace
 *   the whole detail page with a skeleton, then rebuild it. The countdown's
 *   interval restarts from scratch on every tab switch. Each tab owning its
 *   own boundary keeps the swap local to the panel below the tabs.
 *
 *   No `<ErrorBoundary>` around each route element: `React.lazy` throws its
 *   import rejection at render, and Suspense does not catch rejections — only
 *   suspensions. A chunk that fails to load (stale deploy, flaky connection)
 *   with no boundary above it unmounts the tree to the root and leaves a white
 *   page. Wrapping each route means a failed chunk costs the content region
 *   and offers a Retry, while the sidebar stays usable.
 *
 *   Boundary *outside* Suspense, not inside: the boundary has to catch the
 *   throw a suspended child produces when its promise rejects, and it has to
 *   outlive the fallback being torn down and replaced. Nesting them the other
 *   way round leaves the rejection with nowhere to land.
 *
 *   No `onRetry={route.reset}` on each boundary: this is what shipped through
 *   Phase 5, and the Retry button it produced could not work. A failed chunk's
 *   rejection is remembered on the lazy component at module scope, so the
 *   boundary's `key` bump discards the fiber and reads the same rejection
 *   straight back — measured, one import attempt before Retry and one after.
 *   The button appeared, cleared the fallback for a frame, and re-threw. See
 *   `lazyRoutes.tsx`'s header for the mechanism and `ErrorBoundary.tsx`'s for
 *   the two other caches that need the same treatment.
 *
 *   `<BoundedRoute>` takes the whole `SplitChunk` rather than a `label`, a
 *   `fallback` and `children` separately, so the component being rendered and
 *   the `reset` being wired to its Retry cannot drift apart. Passing them as
 *   two props invites exactly one bug — `PoliciesRoute.Component` next to
 *   `DashboardRoute.reset` — which type-checks, renders correctly, and turns
 *   Retry back into a no-op on one route only.
 */

import { Suspense, type ReactElement, type ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './shared/components/ErrorBoundary';
import { Skeleton } from './shared/components/Skeleton';
import { AppLayout } from './shared/layout/AppLayout';
import {
  ClaimIntakeRoute,
  DashboardRoute,
  NotFoundRoute,
  PoliciesRoute,
  PolicyClaimsRoute,
  PolicyCoverageRoute,
  PolicyDetailRoute,
  PolicyDocumentsRoute,
  QuoteWizardRoute,
  UnderwritingRoute,
  type LazyRoute,
} from './shared/routes/lazyRoutes';
import { RequireRole } from './shared/routes/RequireRole';

interface BoundedRouteProps {
  label: string;
  fallback: ReactNode;
  route: LazyRoute;
}

/**
 * One route's worth of boundaries, plus the chunk they guard. The nesting order
 * is load-bearing — see this file's header for why the ErrorBoundary sits
 * outside the Suspense, and why it needs `route.reset` to make Retry real.
 */
function BoundedRoute({ label, fallback, route }: BoundedRouteProps): ReactElement {
  return (
    <ErrorBoundary label={label} onRetry={route.reset}>
      <Suspense fallback={fallback}>
        <route.Component />
      </Suspense>
    </ErrorBoundary>
  );
}

export default function App(): ReactElement {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route
          index
          element={
            <BoundedRoute
              label="Dashboard"
              fallback={<Skeleton variant="panel" rows={5} />}
              route={DashboardRoute}
            />
          }
        />

        <Route
          path="policies"
          element={
            <BoundedRoute
              label="Policy book"
              fallback={
                <Skeleton variant="table" rows={10} columns={6} label="Loading policies" />
              }
              route={PoliciesRoute}
            />
          }
        />

        <Route
          path="policies/:id"
          element={
            <BoundedRoute
              label="Policy detail"
              fallback={<Skeleton variant="card" fields={6} />}
              route={PolicyDetailRoute}
            />
          }
        >
          <Route
            index
            element={
              <BoundedRoute
                label="Coverage"
                fallback={
                  <Skeleton variant="table" rows={4} columns={4} label="Loading coverage" />
                }
                route={PolicyCoverageRoute}
              />
            }
          />
          <Route
            path="claims"
            element={
              <BoundedRoute
                label="Claims"
                fallback={
                  <Skeleton variant="table" rows={4} columns={5} label="Loading claims" />
                }
                route={PolicyClaimsRoute}
              />
            }
          />
          <Route
            path="documents"
            element={
              <BoundedRoute
                label="Documents"
                fallback={
                  <Skeleton variant="table" rows={4} columns={4} label="Loading documents" />
                }
                route={PolicyDocumentsRoute}
              />
            }
          />
        </Route>

        {/*
          QuoteProvider used to wrap this element, so that it sat OUTSIDE the
          Suspense boundary — inside it, the provider would unmount and
          remount alongside the fallback every time the chunk suspends, and
          `initQuoteDraft` (W2-D3-03) would re-run, silently discarding an
          in-progress draft. It now lives in `main.tsx` above the Router,
          which satisfies that constraint the same way and one level further
          out; see the provider-order note there for why it is mounted
          beside the Redux `Provider` rather than on this route.
        */}
        <Route
          path="quote"
          element={
            <BoundedRoute
              label="Quote wizard"
              fallback={<Skeleton variant="panel" rows={6} />}
              route={QuoteWizardRoute}
            />
          }
        />

        <Route
          path="claims/new"
          element={
            <BoundedRoute
              label="Claim intake"
              fallback={<Skeleton variant="panel" rows={4} />}
              route={ClaimIntakeRoute}
            />
          }
        />

        <Route
          path="underwriting"
          element={
            <RequireRole role="underwriter">
              <BoundedRoute
                label="Underwriting"
                fallback={<Skeleton variant="panel" rows={6} />}
                route={UnderwritingRoute}
              />
            </RequireRole>
          }
        />

        <Route
          path="*"
          element={
            <BoundedRoute
              label="Not found"
              fallback={<Skeleton variant="panel" rows={2} />}
              route={NotFoundRoute}
            />
          }
        />
      </Route>
    </Routes>
  );
}
