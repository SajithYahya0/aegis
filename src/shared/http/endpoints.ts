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
