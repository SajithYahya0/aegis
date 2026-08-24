/**
 * WHY THIS EXISTS:
 *   The route `RequireRole` protects. Placeholder body — the underwriting
 *   queue itself is a later phase — but reaching this component at all is the
 *   proof that the role gate worked, so it names the current user to make
 *   that visible.
 *
 * CONCEPTS: (protected by RequireRole — see src/shared/routes/RequireRole.tsx for W2-D4-09)
 *
 * WITHOUT THIS:
 *   `/underwriting` in the route table would have nowhere to send an
 *   underwriter who *is* allowed through, so the only observable behaviour of
 *   `RequireRole` would be the rejection path — there would be nothing to
 *   compare it against.
 */

import type { ReactElement } from 'react';
import { useAuth } from '../shared/store/AuthContext';

export default function UnderwritingPage(): ReactElement {
  const { user } = useAuth();

  return (
    <div>
      <h1>Underwriting</h1>
      <p>Welcome, {user.name}. The claims approval queue arrives in a later phase.</p>
    </div>
  );
}
