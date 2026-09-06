/**
 * WHY THIS EXISTS:
 *   The typed calls the app actually makes over the axios stack. One function
 *   per endpoint a running surface consumes, each taking the `AbortSignal` its
 *   caller already owns and handing it straight to axios as `config.signal`.
 *
 *   The signatures deliberately match their counterparts in
 *   `src/shared/api.ts` — `fetchClaimsForPolicy(policyId, signal)`,
 *   `submitClaim(draft, options)` — so moving a surface from the hand-rolled
 *   transport to the axios one is a one-line change to an import statement,
 *   and the two implementations can be read side by side without first
 *   translating between two shapes.
 *
 *   There are exactly two functions here, and that is deliberate: the mock
 *   backend answers six more routes, but a typed wrapper for a route no
 *   component calls is dead code wearing a client's clothes. Those routes are
 *   exercised by `interceptors.test.ts` against `http` directly until
 *   `/underwriting` (W4-D5-04) gives them a real consumer.
 *
 * CONCEPTS: W4-D3-01, W4-D3-05
 *
 * WITHOUT THIS:
 *   Components call `http.get('/policies/' + id + '/claims')` inline. The URL
 *   is then built at the call site — so an id containing a `/` or a `?` walks
 *   straight into the path — and the response is `AxiosResponse<unknown>`, so
 *   every consumer either casts it or gives up on types. `PolicyClaimsTab`
 *   would be handling `response.data` rather than `Claim[]`, and the
 *   `useOptimistic` overlay it builds on that array (C-05) would be typed
 *   against nothing.
 *
 *   Passing the signal is the load-bearing half. `useFetch` aborts the
 *   previous request when `policyId` changes; if that signal never reaches
 *   axios, the abort is a no-op at the transport, the stale response arrives
 *   anyway, and the only thing standing between the user and another policy's
 *   claims under this policy's header is `useFetch`'s own `signal.aborted`
 *   guard — one line, in one hook, protecting every consumer that will ever
 *   exist.
 */

import { http } from './client';
import type { Claim, ClaimType } from '../types';

export interface ClaimDraft {
  policyId: string;
  type: ClaimType;
  amount: number;
  description: string;
}

export interface SubmitClaimOptions {
  signal?: AbortSignal;
  /**
   * Forces the write to fail, so the optimistic-update rollback (C-05) can be
   * demonstrated on demand. Sent in the request body rather than acted on in
   * the client, because the point of the toggle is that the *server* rejects a
   * write the client had no reason to expect to fail — a client-side throw
   * would never reach the interceptors and would prove nothing about how a
   * real rejection is normalised.
   */
  forceFailure?: boolean;
}

const policyPath = (policyId: string): string => `/policies/${encodeURIComponent(policyId)}`;

export async function fetchClaimsForPolicy(
  policyId: string,
  signal?: AbortSignal,
): Promise<readonly Claim[]> {
  const response = await http.get<Claim[]>(`${policyPath(policyId)}/claims`, { signal });
  return response.data;
}

export async function submitClaim(
  draft: ClaimDraft,
  options: SubmitClaimOptions = {},
): Promise<Claim> {
  const response = await http.post<Claim>(
    `${policyPath(draft.policyId)}/claims`,
    {
      type: draft.type,
      amount: draft.amount,
      description: draft.description,
      forceFailure: options.forceFailure ?? false,
    },
    { signal: options.signal },
  );
  return response.data;
}
