/**
 * WHY THIS EXISTS:
 *   The name `useAuth()` survives the move to Redux Toolkit, on purpose. It
 *   is now a thin wrapper over `useAppSelector` plus one `useAppDispatch`
 *   instead of a wrapper over `useContext`, and it returns the same three
 *   things it always returned — `user`, `role`, `switchRole` — so `AppShell`,
 *   `RequireRole` and `UnderwritingPage` changed their import path and
 *   nothing else. The migration is therefore reviewable as what it actually
 *   is (the store underneath changed) rather than as a diff touching every
 *   consumer.
 *
 * CONCEPTS: W4-D4-01, W4-D4-03
 *
 * WITHOUT THIS:
 *   Every consumer writes `useAppSelector(selectRole)` and its own
 *   `useAppDispatch()` inline, and the two-step a role switch actually
 *   requires gets copied with it. That switch is two dispatches, not one, and
 *   the reason is worth stating because a hand-written call site will get it
 *   wrong: `switchRole` flips the UI immediately, and `loginThunk` re-mints
 *   the bearer token for the new role because the backend stamps the role
 *   into the token it issues (`at-3-underwriter`). Skip the second dispatch
 *   and an underwriter goes on presenting an agent's token to every
 *   subsequent request — the console shows it, nothing else does. Skip the
 *   first and the nav does not move until the round trip lands, so the button
 *   feels broken on a slow connection.
 *
 *   They are separate dispatches rather than one thunk that does both because
 *   they can fail independently, and only one of them may. A refused re-mint
 *   must leave `status: 'error'` on screen with the role already switched, so
 *   the user can see what is wrong; rolling the role back would hide the
 *   failure behind a control that silently snapped back.
 *
 *   FOUR SEPARATE SELECTOR CALLS, NOT ONE RETURNING AN OBJECT: a selector that
 *   returned `{ user, role, status, error }` would build a new object on every
 *   run, `Object.is` would never match it against the previous one, and every
 *   component calling this hook would re-render after every dispatched action
 *   in the app — which is the exact failure `selectors.ts` documents for the
 *   un-memoised exposure roll-up. Four reads of four stable values re-render
 *   only when one of those four values actually changes.
 *
 *   The hand-rolled "must be called within an <AuthProvider>" guard is gone
 *   and is not missed: `useSelector` outside a `<Provider>` throws
 *   "could not find react-redux context value", which names the missing
 *   provider the same way and is maintained by someone else.
 */

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
