/**
 * WHY THIS EXISTS:
 *   Gates a route behind a role. `/underwriting` wraps its element in this so
 *   that an agent who types the URL directly — not just one who clicks a
 *   hidden nav link — is actually turned away.
 *
 * CONCEPTS: W2-D4-06, W2-D4-08, W2-D4-09, W4-D4-01
 *
 * WITHOUT THIS:
 *   No wrapper means the route table has to special-case `/underwriting`
 *   inline, and every future protected route repeats the same
 *   `useAuth`/redirect dance with its own chance to get the comparison
 *   backwards. Worse: without `useLocation`, the redirect has no memory of
 *   what the agent was trying to reach, so the dashboard cannot explain why
 *   they landed there — "you got redirected" with no "from where" reads as a
 *   bug, not a permission boundary.
 */

import { useEffect, type ReactElement, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/useAuth';
import type { Role } from '../types';

export interface RequireRoleProps {
  role: Role;
  children: ReactNode;
}

export function RequireRole({ role, children }: RequireRoleProps): ReactElement | null {
  const { role: currentRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const allowed = currentRole === role;

  useEffect(() => {
    if (allowed) return;
    navigate('/', { replace: true, state: { attemptedPath: location.pathname } });
  }, [allowed, location.pathname, navigate]);

  if (!allowed) {
    return null;
  }

  return <>{children}</>;
}
