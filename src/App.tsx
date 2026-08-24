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
} from './shared/routes/lazyRoutes';
import { RequireRole } from './shared/routes/RequireRole';
import { AuthProvider } from './shared/store/AuthContext';
import { QuoteProvider } from './shared/store/QuoteContext';

interface LazyRouteProps {
  label: string;
  fallback: ReactNode;
  children: ReactNode;
}

/**
 * One route's worth of boundaries. The nesting order is load-bearing — see
 * this file's header for why the ErrorBoundary sits outside the Suspense.
 */
function LazyRoute({ label, fallback, children }: LazyRouteProps): ReactElement {
  return (
    <ErrorBoundary label={label}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </ErrorBoundary>
  );
}

export default function App(): ReactElement {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route
            index
            element={
              <LazyRoute label="Dashboard" fallback={<Skeleton variant="panel" rows={5} />}>
                <DashboardRoute.Component />
              </LazyRoute>
            }
          />

          <Route
            path="policies"
            element={
              <LazyRoute
                label="Policy book"
                fallback={
                  <Skeleton variant="table" rows={10} columns={6} label="Loading policies" />
                }
              >
                <PoliciesRoute.Component />
              </LazyRoute>
            }
          />

          <Route
            path="policies/:id"
            element={
              <LazyRoute label="Policy detail" fallback={<Skeleton variant="card" fields={6} />}>
                <PolicyDetailRoute.Component />
              </LazyRoute>
            }
          >
            <Route
              index
              element={
                <LazyRoute
                  label="Coverage"
                  fallback={
                    <Skeleton variant="table" rows={4} columns={4} label="Loading coverage" />
                  }
                >
                  <PolicyCoverageRoute.Component />
                </LazyRoute>
              }
            />
            <Route
              path="claims"
              element={
                <LazyRoute
                  label="Claims"
                  fallback={
                    <Skeleton variant="table" rows={4} columns={5} label="Loading claims" />
                  }
                >
                  <PolicyClaimsRoute.Component />
                </LazyRoute>
              }
            />
            <Route
              path="documents"
              element={
                <LazyRoute
                  label="Documents"
                  fallback={
                    <Skeleton variant="table" rows={4} columns={4} label="Loading documents" />
                  }
                >
                  <PolicyDocumentsRoute.Component />
                </LazyRoute>
              }
            />
          </Route>

          {/*
            QuoteProvider stays OUTSIDE the Suspense boundary. Inside it, the
            provider would unmount and remount alongside the fallback every
            time the chunk suspends, and `initQuoteDraft` (W2-D3-03) would
            re-run — silently discarding an in-progress draft.
          */}
          <Route
            path="quote"
            element={
              <QuoteProvider>
                <LazyRoute label="Quote wizard" fallback={<Skeleton variant="panel" rows={6} />}>
                  <QuoteWizardRoute.Component />
                </LazyRoute>
              </QuoteProvider>
            }
          />

          <Route
            path="claims/new"
            element={
              <LazyRoute label="Claim intake" fallback={<Skeleton variant="panel" rows={4} />}>
                <ClaimIntakeRoute.Component />
              </LazyRoute>
            }
          />

          <Route
            path="underwriting"
            element={
              <RequireRole role="underwriter">
                <LazyRoute label="Underwriting" fallback={<Skeleton variant="panel" rows={6} />}>
                  <UnderwritingRoute.Component />
                </LazyRoute>
              </RequireRole>
            }
          />

          <Route
            path="*"
            element={
              <LazyRoute label="Not found" fallback={<Skeleton variant="panel" rows={2} />}>
                <NotFoundRoute.Component />
              </LazyRoute>
            }
          />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
