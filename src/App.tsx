/**
 * WHY THIS EXISTS:
 *   The route table, and nothing else. `BrowserRouter` lives in `main.tsx`;
 *   there is no `<Suspense>` boundary here (per-route boundaries arrive in
 *   Phase 4, deliberately, so a missing one is observable rather than papered
 *   over by a catch-all at the top). This file's only job is to say which
 *   element renders for which path.
 *
 * CONCEPTS: W2-D4-02, W2-D4-09
 *
 * WITHOUT THIS:
 *   There is no other place in the app that maps a URL to a component — this
 *   is that map. Without it every route's page component would need its own
 *   ad hoc mounting logic, and nested routes like `/policies/:id/claims`
 *   would have no parent to inherit their layout and `<Outlet>` from.
 */

import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router-dom';
import ClaimIntakePage from './routes/ClaimIntakePage';
import DashboardPage from './routes/DashboardPage';
import NotFoundPage from './routes/NotFoundPage';
import PolicyCoverageTab from './routes/policyDetail/PolicyCoverageTab';
import PolicyClaimsTab from './routes/policyDetail/PolicyClaimsTab';
import PolicyDocumentsTab from './routes/policyDetail/PolicyDocumentsTab';
import PolicyDetailPage from './routes/PolicyDetailPage';
import PoliciesPage from './routes/PoliciesPage';
import QuoteWizardPage from './routes/QuoteWizardPage';
import UnderwritingPage from './routes/UnderwritingPage';
import { AppLayout } from './shared/layout/AppLayout';
import { RequireRole } from './shared/routes/RequireRole';
import { AuthProvider } from './shared/store/AuthContext';
import { QuoteProvider } from './shared/store/QuoteContext';

export default function App(): ReactElement {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />

          <Route path="policies" element={<PoliciesPage />} />
          <Route path="policies/:id" element={<PolicyDetailPage />}>
            <Route index element={<PolicyCoverageTab />} />
            <Route path="claims" element={<PolicyClaimsTab />} />
            <Route path="documents" element={<PolicyDocumentsTab />} />
          </Route>

          <Route
            path="quote"
            element={
              <QuoteProvider>
                <QuoteWizardPage />
              </QuoteProvider>
            }
          />

          <Route path="claims/new" element={<ClaimIntakePage />} />

          <Route
            path="underwriting"
            element={
              <RequireRole role="underwriter">
                <UnderwritingPage />
              </RequireRole>
            }
          />

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
