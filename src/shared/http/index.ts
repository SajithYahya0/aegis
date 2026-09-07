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
