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
