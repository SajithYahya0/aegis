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
 *   This file used to say "there are exactly two functions here, and that is
 *   deliberate — a typed wrapper for a route no component calls is dead code
 *   wearing a client's clothes", and named `/underwriting` (W4-D5-04) as the
 *   surface that would earn the rest. That surface is now built, so four more
 *   functions have real consumers: `fetchPolicies`, `fetchAllClaims` and
 *   `fetchUnderwritingLimits` are the three reads `UnderwritingPage` fires in
 *   parallel, and `submitUnderwritingDecision` is its form's write. The
 *   remaining mock routes — `GET /policies/:id`, `GET /policies/:id/documents`,
 *   `GET /risk-feed/:id` — still have no component calling them and still have
 *   no wrapper here for exactly that reason.
 *
 * CONCEPTS: W4-D3-01, W4-D3-04, W4-D3-05
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
import type { Claim, ClaimType, Policy } from '../types';

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

/* -------------------------------------------------------------------------- */
/* Underwriting                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The branch's underwriting authority, as the backend states it. Three numbers
 * rather than one because the referral queue asks three different questions of
 * them, and folding them into a single "limit" is how a rule about *binding*
 * quietly starts being applied to *loading*.
 *
 * Declared here rather than in `mockBackend.ts` on purpose: this file is the
 * contract, the mock is one implementation of it, and a real backend would
 * replace the mock without touching a line of this. `mockBackend.ts` imports
 * these three types back — a type-only import, so it adds no runtime edge to
 * the module graph.
 */
export interface UnderwritingLimits {
  /** Above this sum insured, a policy cannot be bound without a referral. */
  autoBindLimit: number;
  /** The largest rate loading an underwriter may apply on their own authority. */
  maxLoadingPct: number;
  /** Loss ratio above which a policy is referred regardless of size. */
  referralLossRatio: number;
}

export type UnderwritingDecisionOutcome = 'accept' | 'refer' | 'decline';

export interface UnderwritingDecision {
  id: string;
  policyId: string;
  outcome: UnderwritingDecisionOutcome;
  loadingPct: number;
  note: string;
  decidedAt: string;
  /** The access token the decision was recorded under — an audit breadcrumb. */
  decidedBy: string;
}

/**
 * The three reads `/underwriting` fires together.
 *
 * They are separate functions rather than one `fetchUnderwritingQueue()` that
 * does the `Promise.all` internally, because the parallelism is the caller's
 * decision and has to be visible where the `AbortSignal` is. Hidden inside one
 * function, a later maintainer "simplifying" it into three sequential awaits
 * would turn a 900ms page load into a 2.7s one and nothing in the signature
 * would have changed.
 */
export async function fetchPolicies(signal?: AbortSignal): Promise<readonly Policy[]> {
  const response = await http.get<Policy[]>('/policies', { signal });
  return response.data;
}

export async function fetchAllClaims(signal?: AbortSignal): Promise<readonly Claim[]> {
  const response = await http.get<Claim[]>('/claims', { signal });
  return response.data;
}

export async function fetchUnderwritingLimits(signal?: AbortSignal): Promise<UnderwritingLimits> {
  const response = await http.get<UnderwritingLimits>('/underwriting/limits', { signal });
  return response.data;
}

export interface UnderwritingDecisionDraft {
  policyId: string;
  outcome: UnderwritingDecisionOutcome;
  loadingPct: number;
  note: string;
}

export async function submitUnderwritingDecision(
  draft: UnderwritingDecisionDraft,
  signal?: AbortSignal,
): Promise<UnderwritingDecision> {
  const response = await http.post<UnderwritingDecision>('/underwriting/decisions', draft, {
    signal,
  });
  return response.data;
}
