import { useCallback } from 'react';
import { loginThunk, switchRole as switchRoleAction, type AuthStatus } from './authSlice';
import { selectRole, selectUser } from './selectors';
import { useAppDispatch, useAppSelector } from './index';
import type { Role, User } from '../types';

export interface AuthView {
  user: User;
  role: Role;
  /** Where the current sign-in or refresh has got to. */
  status: AuthStatus;
  /** The server's own words when `status` is `'error'`, else `null`. */
  error: string | null;
  /** Flips the role and re-authenticates as it — see the header. */
  switchRole: (role: Role) => void;
}

export function useAuth(): AuthView {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const role = useAppSelector(selectRole);
  const status = useAppSelector((state) => state.auth.status);
  const error = useAppSelector((state) => state.auth.error);

  const switchRole = useCallback(
    (next: Role) => {
      dispatch(switchRoleAction(next));
      // Fire-and-forget: the outcome is already in the store as `status` and
      // `error`, which is what the AppBar renders. Awaiting it here would need
      // a `useState` beside the store holding the same two facts.
      void dispatch(loginThunk(next));
    },
    [dispatch],
  );

  return { user, role, status, error, switchRole };
}
