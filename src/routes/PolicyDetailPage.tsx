/**
 * WHY THIS EXISTS:
 *   The `/policies/:id` shell: reads the id out of the URL, renders the async
 *   summary card and the risk-exposure widget, and hangs the Coverage / Claims
 *   / Documents tabs off its own `<Outlet>` as nested routes rather than as
 *   three conditionally-rendered divs switched by local state. The renewal
 *   countdown lives here too — it is about the policy as a whole, not about
 *   any one tab, and needs to keep ticking whichever tab is open.
 *
 *   It is also where the page's two independent failure domains are drawn:
 *   the summary card (local data, must succeed) and the risk widget (third
 *   party, allowed to fail) each get their own boundary.
 *
 * CONCEPTS: W2-D4-03, W2-D4-05, W3-D5-01, W3-D5-04, W3-D4-03
 *
 * WITHOUT THIS:
 *   Three divs toggled by a `useState<'coverage' | 'claims' | 'documents'>`
 *   would work, but the active tab would not survive a reload, a bookmark, or
 *   the browser's back button — `/policies/POL-00012/claims` would not be a
 *   real, shareable address, it would just be `/policies/POL-00012` that
 *   happens to be showing claims right now because of client state nobody else
 *   can see.
 *
 *   No `<Suspense>` around `PolicySummaryCard` here: the card calls `use()`, so
 *   its first render suspends. React then walks up for the nearest boundary,
 *   finds the route-level one in `App.tsx`, and replaces the *entire* detail
 *   page — including the tab nav and the Outlet — with the route skeleton for
 *   400–900ms. Worse, it does that again on every navigation to a policy that
 *   is not yet cached, so the tabs flicker out from under the user's cursor.
 *   The boundary belongs immediately around the thing that suspends.
 *
 *   No separate boundary for the risk widget: see `RiskExposureWidget`'s
 *   header. A single boundary at this level would let one dead vendor feed
 *   blank the whole policy.
 *
 *   `key={policyId}` on the summary card's boundary: navigating from POL-1 to
 *   POL-2 while POL-1's boundary is showing an error would otherwise reconcile
 *   the two — same element type, same position — and the boundary would still
 *   be holding POL-1's error state, so POL-2 would render as a failure it
 *   never had. The key forces a fresh boundary per policy, which is the same
 *   remount mechanism the Retry button uses, applied to a different trigger.
 */

import { Suspense, type ReactElement } from 'react';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import { clearPolicyResource } from '../shared/api';
import { ErrorBoundary } from '../shared/components/ErrorBoundary';
import { Skeleton } from '../shared/components/Skeleton';
import { policiesById } from '../shared/data';
import { PolicySummaryCard } from './policyDetail/PolicySummaryCard';
import { RenewalCountdown } from './policyDetail/RenewalCountdown';
import { RiskExposurePanel } from './policyDetail/RiskExposureWidget';

function tabClassName({ isActive }: { isActive: boolean }): string {
  return isActive ? 'active' : '';
}

export default function PolicyDetailPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const policyId = id ?? '';
  const policy = policiesById.get(policyId);

  return (
    <div>
      <h1>Policy {policyId}</h1>

      {policy ? <RenewalCountdown endDate={policy.endDate} /> : null}

      <ErrorBoundary
        key={policyId}
        label={`Policy ${policyId}`}
        onRetry={() => clearPolicyResource(policyId)}
      >
        <Suspense fallback={<Skeleton variant="card" fields={6} label="Loading policy summary" />}>
          <PolicySummaryCard policyId={policyId} />
        </Suspense>
      </ErrorBoundary>

      <RiskExposurePanel key={`risk-${policyId}`} policyId={policyId} />

      <nav>
        <NavLink to="." end className={tabClassName}>
          Coverage
        </NavLink>{' '}
        <NavLink to="claims" className={tabClassName}>
          Claims
        </NavLink>{' '}
        <NavLink to="documents" className={tabClassName}>
          Documents
        </NavLink>
      </nav>

      <Outlet />
    </div>
  );
}
