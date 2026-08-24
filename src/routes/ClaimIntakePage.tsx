/**
 * WHY THIS EXISTS:
 *   The `/claims/new` route target. Placeholder for Phase 1 — the real intake
 *   form (`useId` fieldsets, `useActionState`, `useOptimistic`, the
 *   component-level `React.lazy` wizard) is built in Phases 3 and 5.
 *
 * CONCEPTS: (none yet — see docs/coverage-matrix.md for the phase that owns this route)
 *
 * WITHOUT THIS:
 *   The sidebar's "New claim" link would 404 into the catch-all route,
 *   making the nav itself look broken rather than merely unfinished.
 */

import type { ReactElement } from 'react';

export default function ClaimIntakePage(): ReactElement {
  return (
    <div>
      <h1>New claim</h1>
      <p>Claim intake wizard arrives in a later phase.</p>
    </div>
  );
}
