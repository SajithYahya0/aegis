/**
 * WHY THIS EXISTS:
 *   The one source of truth for "who is using AEGIS right now and what can
 *   they do." Every role-gated action — the /underwriting route chief among
 *   them — reads its answer from here rather than from a prop threaded down
 *   from wherever login happened to occur.
 *
 * CONCEPTS: W2-D2-04, W2-D2-07, W3-D1-04
 *
 * WITHOUT THIS:
 *   Two things break. First, without a shared context, "current role" would
 *   have to be prop-drilled from `main.tsx` through `App` through `AppLayout`
 *   into every page that cares — and `RequireRole`, which is not a child of
 *   any page, would have no way to read it at all. Second, without the
 *   `useMemo` around the provider value, every render of `AuthProvider` (which
 *   wraps the entire routed tree) hands `useContext(AuthContext)` consumers a
 *   brand-new `{ user, role, switchRole }` object — so `React.memo` on
 *   anything downstream that consumes auth (the sidebar, role-gated buttons)
 *   never bails out, because the object it received is a new reference even
 *   when the role has not changed.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Role, User } from '../types';

const DEMO_USERS: Record<Role, User> = {
  agent: { id: 'usr-agent-01', name: 'Priya Nair', role: 'agent', branch: 'Chennai' },
  underwriter: {
    id: 'usr-uw-01',
    name: 'Arvind Rao',
    role: 'underwriter',
    branch: 'Mumbai — Underwriting',
  },
};

export interface AuthContextValue {
  user: User;
  role: Role;
  /** Explicit, visible role switching — this is a demo, not a real login. */
  switchRole: (role: Role) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>('agent');

  const switchRole = useCallback((next: Role) => setRole(next), []);

  const value = useMemo<AuthContextValue>(
    () => ({ user: DEMO_USERS[role], role, switchRole }),
    [role, switchRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Guarded consumption: a component that calls this outside `AuthProvider`
 * gets a message pointing at the missing provider, not `Cannot read
 * properties of null` three stack frames into a render it did not write.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth() must be called within an <AuthProvider>.');
  }
  return ctx;
}
