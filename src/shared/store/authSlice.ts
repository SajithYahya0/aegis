/**
 * WHY THIS EXISTS:
 *   The session, as a Redux Toolkit slice: who is signed in, what role they
 *   are acting as, the tokens the axios stack presents, and where the sign-in
 *   itself has got to. It replaces `AuthContext` — the Context + `useState`
 *   version this repo shipped through Week 3 — and it also replaces
 *   `src/shared/http/tokenStore.ts`, the module-level variable the request
 *   interceptor used to read the bearer token out of.
 *
 *   `QuoteContext` deliberately does NOT move. It stays on Context +
 *   `useReducer` so the two approaches sit side by side in one running app and
 *   can be read against each other (W4-D4-05, and the Week 4 boundary section
 *   in CLAUDE.md).
 *
 * CONCEPTS: W4-D4-02, W4-D4-03, W4-D4-05
 *
 * WITHOUT THIS:
 *   Three separate failures, one per thing this file is doing.
 *
 *   1. NO IMMER — i.e. `switchRole` written the way `quoteReducer` has to
 *   write it, `return { ...state, role, user: DEMO_USERS[role] }`. The mutable
 *   form below is not a shortcut: `createSlice` runs every case reducer inside
 *   Immer's `produce`, so `state` is a *draft* proxy and every assignment is
 *   recorded rather than applied. What comes out is a NEW object, structurally
 *   shared with the old one — the branches nobody touched keep their identity,
 *   the ones that changed do not.
 *
 *   That "new object" half is the load-bearing half, and it is what breaks if
 *   Immer is not there. `react-redux` decides whether to re-render by
 *   comparing what a selector returned last time against what it returns now
 *   with `Object.is`. If a reducer genuinely mutated the state object in
 *   place, before and after would be the same reference, every comparison
 *   would answer "unchanged", and NOTHING WOULD RE-RENDER: the role switcher
 *   in the AppBar would not move, `RequireRole` would go on gating against the
 *   old role, and `/underwriting` would keep redirecting an underwriter to the
 *   dashboard. The bug is invisible in the reducer — the state is right, the
 *   store is right, only the screen is wrong. That is exactly the failure
 *   `quoteReducer`'s registered `mutating-reducer` defect (W2-D3-02)
 *   demonstrates one folder away, and the point of writing these two reducers
 *   in opposite styles is that the mutation here is safe *for a reason a
 *   reader can name*, not because mutation stopped mattering.
 *
 *   2. NO THUNKS — the login POST fired from a component effect instead. The
 *   request that establishes the session has to happen before React has
 *   mounted anything that needs it: the axios request interceptor fires it on
 *   the first outgoing request, which can be a route's effect on the very
 *   first frame. There is no component whose lifecycle it belongs to. Written
 *   as an effect it would also carry its own `loading`/`error` `useState`
 *   pair — a third copy of the same three states in this app — and
 *   `RequireRole`, which is not below that component, could not read any of
 *   them.
 *
 *   3. NO `extraReducers` HANDLING ALL THREE LIFECYCLE ACTIONS — only
 *   `fulfilled` handled, which is the usual shortcut. `pending` is what puts
 *   `status` into `'loading'`, and without it the AppBar's role switcher stays
 *   live during the re-authentication a role switch triggers, so a second
 *   switch can be fired while the first is still in flight and which token the
 *   store ends up holding is decided by a race. `rejected` is what makes a
 *   refused refresh terminal: without it `status` stays `'authenticated'`
 *   while `token` is null, and the UI reports a healthy session that cannot
 *   make a single request.
 *
 *   WHY `refreshToken` IS IN THE STATE, beyond the five fields the brief named:
 *   the 401 handler needs it at the one moment the access token is known to be
 *   worthless, and the only alternative is leaving it in a module variable —
 *   which means half the session lives in the store and half does not, and a
 *   `logout()` that clears one but not the other is a one-line mistake that
 *   leaves a spent refresh token behind to be replayed.
 */

import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AxiosInstance } from 'axios';
import type { Role, User } from '../types';

/**
 * The demo directory. There is no sign-up and no user table — the identity is
 * fixed and the role is a control in the AppBar, exactly as it was under
 * `AuthContext`. Both entries are module constants, so `DEMO_USERS[role]` is
 * referentially stable per role; `selectExposureByCustomer` in `selectors.ts`
 * memoises on that identity.
 */
export const DEMO_USERS: Record<Role, User> = {
  agent: { id: 'usr-agent-01', name: 'Priya Nair', role: 'agent', branch: 'Chennai' },
  underwriter: {
    id: 'usr-uw-01',
    name: 'Arvind Rao',
    role: 'underwriter',
    branch: 'Mumbai',
  },
};

const USERNAME: Record<Role, string> = {
  agent: 'priya.nair',
  underwriter: 'arvind.rao',
};

/** What `POST /auth/login` and `POST /auth/refresh` answer with. */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'error';

export interface AuthState {
  user: User;
  role: Role;
  token: string | null;
  /** See the header — the 401 handler's half of the pair. */
  refreshToken: string | null;
  status: AuthStatus;
  error: string | null;
}

const initialState: AuthState = {
  user: DEMO_USERS.agent,
  role: 'agent',
  token: null,
  refreshToken: null,
  status: 'idle',
  error: null,
};

/* -------------------------------------------------------------------------- */
/* Thunks                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The axios instance the thunks talk to, handed in as the thunk middleware's
 * `extraArgument` rather than imported.
 *
 * Imported directly, this module would pull in `src/shared/http/index.ts`,
 * which installs the interceptors — and one of those interceptors dispatches
 * these very thunks. That is a genuine import cycle, and its symptom is not a
 * warning: `configureStore` would run while this module was still evaluating
 * and read an undefined reducer. Injecting the instance also means
 * `interceptors.test.ts` can build a store whose thunks talk to the throwaway
 * instance that test owns rather than to the app's.
 */
export interface ThunkExtra {
  http: AxiosInstance;
}

/**
 * The thunk API shape, spelled out locally rather than pulled from
 * `RootState`. `RootState` is derived from the store, the store is built from
 * this reducer, and naming it here would make the type circular — TypeScript
 * gives up on that and silently infers `any` for `getState()`, which is the
 * one place in this file a wrong field name would go unnoticed.
 */
interface AuthThunkApi {
  state: { auth: AuthState };
  extra: ThunkExtra;
  rejectValue: string;
}

/**
 * Interceptor (c) in `src/shared/http/interceptors.ts` has already turned
 * every transport failure into an `ApiError` carrying the server's own
 * message, so there is nothing left to unwrap here — reading `.message` is
 * reading the backend's words. Importing `ApiError` in order to `instanceof`
 * it would add a second import cycle for no extra information.
 */
function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * `POST /auth/login`. Takes the role to sign in as, because the mock backend
 * stamps it into the token it issues (`at-3-underwriter`) — which is what
 * makes re-authenticating on a role switch meaningful rather than ceremonial.
 */
export const loginThunk = createAsyncThunk<TokenPair, Role, AuthThunkApi>(
  'auth/login',
  async (role, { extra, rejectWithValue }) => {
    try {
      const response = await extra.http.post<TokenPair>('/auth/login', {
        username: USERNAME[role],
        role,
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(messageOf(error, 'Sign-in failed.'));
    }
  },
);

/**
 * `POST /auth/refresh`. Reads the refresh token off the store rather than
 * taking it as an argument, so a caller cannot present one the store has
 * already replaced — the backend spends a refresh token on use, and a stale
 * one is a logout.
 *
 * This is NOT where the single flight lives. Two concurrent dispatches of this
 * thunk would send two refreshes; the de-duplication is the interceptor's
 * `refreshOnce()`, which is this thunk's only caller and which owns the shared
 * promise every 401 waits on.
 */
export const refreshThunk = createAsyncThunk<TokenPair, void, AuthThunkApi>(
  'auth/refresh',
  async (_arg, { getState, extra, rejectWithValue }) => {
    const refreshToken = getState().auth.refreshToken;
    if (!refreshToken) {
      return rejectWithValue('Session expired and there is no refresh token to renew it with.');
    }
    try {
      const response = await extra.http.post<TokenPair>('/auth/refresh', { refreshToken });
      return response.data;
    } catch (error) {
      return rejectWithValue(messageOf(error, 'Session expired.'));
    }
  },
);

/* -------------------------------------------------------------------------- */
/* Slice                                                                      */
/* -------------------------------------------------------------------------- */

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /**
     * Written as mutation. See the header: Immer's draft turns these two
     * assignments into a new `auth` object, and it is that new identity — not
     * the assignment — that gets `RequireRole` and the AppBar to re-render. A
     * reducer that really mutated in place would leave the screen showing the
     * old role forever.
     */
    switchRole(state, action: PayloadAction<Role>) {
      state.role = action.payload;
      state.user = DEMO_USERS[action.payload];
    },

    /**
     * Also mutation, and every field written out rather than
     * `return initialState`. Both forms are correct; this one is the one a
     * reader can diff against `AuthState` to see that nothing was left
     * behind. Nothing being left behind is the whole job — a `logout` that
     * keeps the refresh token keeps the dead session replayable.
     */
    logout(state) {
      state.user = DEMO_USERS.agent;
      state.role = 'agent';
      state.token = null;
      state.refreshToken = null;
      state.status = 'idle';
      state.error = null;
      console.log('[auth] session cleared');
    },
  },

  /*
   * Builder callback, and all three lifecycle actions for both thunks. The
   * object-map form of `extraReducers` was removed in Redux Toolkit 2.x, and
   * the builder is also what keeps `action.payload` typed per case — it is
   * why `action.payload.accessToken` below is checked at all.
   */
  extraReducers: (builder) => {
    builder
      .addCase(loginThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.status = 'authenticated';
        state.token = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.error = null;
        console.log(`[auth] signed in as ${state.role} — ${action.payload.accessToken}`);
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.status = 'error';
        // `payload` is what `rejectWithValue` was given; `error.message` is
        // what an unexpected throw left behind. Preferring the first keeps
        // the server's words ahead of the transport's.
        state.error = action.payload ?? action.error.message ?? 'Sign-in failed.';
        // The existing tokens deliberately survive. A failed login is usually
        // the re-mint a role switch fires, and the session it would be
        // discarding is a working one — blanking it would turn a transient
        // failure into a signed-out user. Dropping the session is `logout()`'s
        // job, and only the 401 handler has the standing to decide that.
      })

      /*
       * The access token is deliberately NOT cleared on `refresh/pending`. A
       * refresh runs while requests are still in flight carrying the old
       * token; blanking it here would make the request interceptor conclude
       * there is no session at all and start a *login* alongside the refresh.
       */
      .addCase(refreshThunk.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(refreshThunk.fulfilled, (state, action) => {
        state.status = 'authenticated';
        state.token = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.error = null;
        console.log(`[auth] session refreshed — ${action.payload.accessToken}`);
      })
      .addCase(refreshThunk.rejected, (state, action) => {
        // Records the outcome, and stops there. The tokens are dropped by the
        // `logout()` the 401 handler dispatches immediately after — see
        // `refreshOnce()` in `src/shared/http/interceptors.ts`. Two places
        // clearing the same two fields is how one of them ends up clearing
        // only one of them.
        state.status = 'error';
        state.error = action.payload ?? action.error.message ?? 'Session expired.';
      });
  },
});

export const { switchRole, logout } = authSlice.actions;
export const authReducer = authSlice.reducer;
