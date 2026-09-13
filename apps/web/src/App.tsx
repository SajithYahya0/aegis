import { Suspense, lazy, type ReactElement, type ReactNode } from 'react';
import { Link as RouterLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import LinearProgress from '@mui/material/LinearProgress';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { AppShell } from './shared/AppShell';
import { ErrorBoundary } from './shared/ErrorBoundary';
import { useAppSelector } from './shared/store';
import type { Role } from './shared/domain';

const DashboardPage = lazy(() => import('./routes/DashboardPage'));
const PoliciesPage = lazy(() => import('./routes/PoliciesPage'));
const PolicyDetailPage = lazy(() => import('./routes/PolicyDetailPage'));
const PolicyCoverageTab = lazy(() =>
  import('./routes/PolicyTabs').then((module) => ({ default: module.PolicyCoverageTab })),
);
const PolicyClaimsTab = lazy(() =>
  import('./routes/PolicyTabs').then((module) => ({ default: module.PolicyClaimsTab })),
);
const QuoteWizardPage = lazy(() => import('./routes/QuoteWizardPage'));
const ClaimIntakeRoute = lazy(() => import('./routes/ClaimIntakeRoute'));
const UnderwritingPage = lazy(() => import('./routes/UnderwritingPage'));

function RequireRole({ role, children }: { role: Role; children: ReactNode }): ReactElement {
  const currentRole = useAppSelector((state) => state.auth.role);
  const location = useLocation();

  if (currentRole !== role) {
    return <Navigate to="/" replace state={{ blockedFrom: location.pathname }} />;
  }
  return <>{children}</>;
}

function NotFoundPage(): ReactElement {
  return (
    <>
      <Typography variant="h1">Page not found</Typography>
      <Link component={RouterLink} to="/">
        Return to the dashboard
      </Link>
    </>
  );
}

export default function App(): ReactElement {
  const location = useLocation();

  return (
    <AppShell>
      <ErrorBoundary key={location.pathname} label="This page">
        <Suspense fallback={<LinearProgress aria-label="Loading" />}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/policies" element={<PoliciesPage />} />
            <Route path="/policies/:id" element={<PolicyDetailPage />}>
              <Route index element={<PolicyCoverageTab />} />
              <Route path="claims" element={<PolicyClaimsTab />} />
            </Route>
            <Route path="/quote" element={<QuoteWizardPage />} />
            <Route path="/claims/new" element={<ClaimIntakeRoute />} />
            <Route
              path="/underwriting"
              element={
                <RequireRole role="underwriter">
                  <UnderwritingPage />
                </RequireRole>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </AppShell>
  );
}
