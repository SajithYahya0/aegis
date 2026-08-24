/**
 * WHY THIS EXISTS:
 *   The `/` index route. Placeholder content for Phase 1 — the book summary
 *   arrives in a later phase — but it does one real job now: it is where a
 *   `RequireRole` redirect lands, so it reads `location.state.attemptedPath`
 *   and tells the agent why they ended up here instead of leaving them to
 *   wonder.
 *
 * CONCEPTS: W2-D4-02, W2-D4-08
 *
 * WITHOUT THIS:
 *   `RequireRole` calls `navigate('/', { state: { attemptedPath } })`, but if
 *   nothing on `/` reads `location.state`, that state is inert — collected
 *   and then discarded, which makes `useLocation`'s presence in `RequireRole`
 *   look decorative rather than load-bearing. An agent bounced off
 *   `/underwriting` would just see the dashboard with no explanation.
 */

import type { ReactElement } from 'react';
import { useLocation } from 'react-router-dom';

interface RedirectState {
  attemptedPath?: string;
}

export default function DashboardPage(): ReactElement {
  const location = useLocation();
  const attemptedPath = (location.state as RedirectState | null)?.attemptedPath;

  return (
    <div>
      <h1>Dashboard</h1>
      {attemptedPath ? (
        <p>
          You were redirected from <code>{attemptedPath}</code> — that page requires the
          underwriter role. Switch roles in the header to view it.
        </p>
      ) : (
        <p>Book summary and renewal pipeline arrive in a later phase.</p>
      )}
    </div>
  );
}
