/**
 * WHY THIS EXISTS:
 *   The public surface of the axios stack, and where the instance is given its
 *   transport: the mock backend, plus the typed endpoints the app calls.
 *   Importing this module is what makes `http` reachable.
 *
 *   THE INTERCEPTORS ARE INSTALLED ONE LEVEL UP, in
 *   `src/shared/store/index.ts`, and they have to be. They now dispatch the
 *   auth slice's thunks and read the bearer token off the store, so installing
 *   them needs a store — and the store needs `http` in order to be built,
 *   which is this module. Calling `installInterceptors(http, store)` from here
 *   would mean reading `store` while `src/shared/store/index.ts` was still
 *   evaluating: a `ReferenceError` at import time under a bundler, and under
 *   Vitest's transform something quieter and worse — a partially initialised
 *   module whose exported function is `undefined`. Installing from the store,
 *   after it exists, is the acyclic order. `main.tsx` imports the store, so it
 *   still happens once, at module load, before React mounts.
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
 *   The mock backend install is a side effect at module load, on purpose. It
 *   must be done before the first request, and the first request can be fired
 *   by a component's effect on the very first frame — there is no later moment
 *   to hook into that is guaranteed to come first.
 */

import { http } from './client';
import { installMockBackend } from './mockBackend';

/**
 * The adapter is kept rather than discarded, and it is the only thing in this
 * folder that exists for a test. `MockAdapter` records every request it
 * answers in `.history`, which is how `UnderwritingPage.test.tsx` asserts that
 * the page fires its three reads *in parallel behind one login* rather than
 * merely that it renders — a claim (W4-D3-04) that a screenshot cannot make
 * and that reading the component cannot settle either, because `Promise.all`
 * and three sequential `await`s look almost identical on the page.
 */
export const backend = installMockBackend(http);

export { http, REQUEST_TIMEOUT_MS } from './client';
export { ApiError, installInterceptors } from './interceptors';
export { installMockBackend } from './mockBackend';
export { fetchClaimsForPolicy, submitClaim } from './endpoints';
export type { ClaimDraft, SubmitClaimOptions } from './endpoints';
