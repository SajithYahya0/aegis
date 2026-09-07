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
