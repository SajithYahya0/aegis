/**
 * WHY THIS EXISTS:
 *   Holds the session's access and refresh tokens. Plain module state with a
 *   getter and a setter — not Context, not `useState` — because the only code
 *   that reads it is an axios interceptor, which runs outside React and has no
 *   component to hang a hook off.
 *
 * CONCEPTS: W4-D3-02, W4-D3-04
 *
 * WITHOUT THIS:
 *   The token has to live in `AuthContext` with the rest of the session, and
 *   the request interceptor then has no way to read it: interceptors are
 *   registered once at module load, run for requests fired from effects,
 *   event handlers and other interceptors, and `useContext` cannot be called
 *   from any of those. The usual workaround is to thread the token in as a
 *   per-request option — which is exactly the "every call site knows about
 *   auth" problem the interceptor exists to delete (W4-D3-02).
 *
 *   The refresh token is kept beside the access token rather than derived
 *   from it because the 401 handler needs it at the one moment the access
 *   token is known to be worthless. Storing only the access token means a
 *   401 has nothing to refresh *with*, and the only recovery left is a full
 *   re-login — which drops whatever the user was doing.
 *
 *   This is a demo store: tokens live in memory and die with the tab, and
 *   nothing here is persisted. That is deliberate. `localStorage` is the
 *   obvious next step and is the one place a bearer token should not go —
 *   any XSS on the page can read it — so the honest demo keeps it in a
 *   module closure where it is at least not scriptable from another origin.
 */

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

let tokens: TokenPair | null = null;

export function getAccessToken(): string | null {
  return tokens?.accessToken ?? null;
}

export function getRefreshToken(): string | null {
  return tokens?.refreshToken ?? null;
}

export function setTokens(next: TokenPair): void {
  tokens = next;
  console.log(`[auth] ✓ tokens stored — access=${next.accessToken}`);
}

/**
 * Drops the session. Called when a refresh is rejected: leaving a token the
 * backend has already refused in place means the next request attaches it,
 * 401s, and refreshes again — a slow loop instead of one clean failure the UI
 * can show.
 */
export function clearTokens(): void {
  tokens = null;
  console.log('[auth] ⌫ tokens cleared');
}
