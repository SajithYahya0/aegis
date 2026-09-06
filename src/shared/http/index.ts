/**
 * WHY THIS EXISTS:
 *   The public surface of the axios stack, and the one place the instance is
 *   wired up: mock backend first, then interceptors, then the typed endpoints
 *   the app calls. Importing this module is what makes `http` usable.
 *
 * CONCEPTS: (barrel + composition root — the concepts live in the files below)
 *
 * WITHOUT THIS:
 *   The wiring has to happen somewhere, and the two alternatives are both
 *   worse. Put it in `client.ts` and the instance can no longer be created
 *   without dragging the whole mock backend and the data layer in behind it,
 *   which is exactly what a test that wants a bare instance is trying to
 *   avoid. Leave it to each consumer and the wiring runs once per importer,
 *   or not at all — a component that imports `http` directly gets an instance
 *   with no adapter, so its request leaves the app and 404s at the dev
 *   server, and no interceptor is registered to explain why.
 *
 *   Both installs are side effects at module load, on purpose. They must be
 *   done before the first request, and the first request can be fired by a
 *   component's effect on the very first frame — there is no later moment to
 *   hook into that is guaranteed to come first.
 */

import { http } from './client';
import { installInterceptors } from './interceptors';
import { installMockBackend } from './mockBackend';

installMockBackend(http);
installInterceptors(http);

export { http, REQUEST_TIMEOUT_MS } from './client';
export { ApiError, installInterceptors } from './interceptors';
export { installMockBackend } from './mockBackend';
export { getAccessToken, getRefreshToken, setTokens, clearTokens } from './tokenStore';
export type { TokenPair } from './tokenStore';
export { fetchClaimsForPolicy, submitClaim } from './endpoints';
export type { ClaimDraft, SubmitClaimOptions } from './endpoints';
