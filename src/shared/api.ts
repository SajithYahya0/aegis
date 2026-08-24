/**
 * WHY THIS EXISTS:
 *   The only async boundary in the app. Serves the in-memory book behind
 *   simulated 400–900ms latency, and does it twice over, on purpose:
 *
 *     • `fetch*(…, signal)` — abortable, for the `useEffect` + `AbortController`
 *       path (W2-D1-01…03). Call it again and it really goes again.
 *     • `getPolicyResource(id)` — a cached promise per id, for the `use()` +
 *       `<Suspense>` path (W3-D5-01, W3-D5-02). Call it again and you get the
 *       same promise object back.
 *
 * CONCEPTS: W2-D1-01, W2-D1-02, W2-D1-03, W3-D5-01, W3-D5-02, W3-D5-04, W3-D4-01
 *
 * WITHOUT THIS:
 *   Two separate disasters, one per path.
 *
 *   No `AbortSignal`: clicking POL-00007 then POL-00012 before the first load
 *   lands leaves two in-flight requests racing. The slower one resolves last
 *   and calls `setClaims` with POL-00007's claims while the URL says
 *   POL-00012 — the user sees another customer's claims under this customer's
 *   header, with no error anywhere. Aborting in the effect's cleanup is what
 *   stops that.
 *
 *   No promise cache: `use(fetchPolicy(id))` calls `fetchPolicy` during render.
 *   Suspense throws that promise, React re-renders when it settles, render runs
 *   again, `fetchPolicy` is called *again*, a new promise is thrown, and the
 *   component suspends forever in an infinite fetch loop. `use()` is only safe
 *   against a promise that is stable across renders, which is what the cache
 *   provides. The cache also memoises *rejections*, which is why the error
 *   boundary's retry must evict the entry — see `clearPolicyResource`.
 */

import {
  claims as allClaims,
  claimsByPolicyId,
  customersById,
  documentsByPolicyId,
  policies as allPolicies,
  policiesById,
} from './data';
import type { Claim, Customer, Policy, PolicyDocument } from './types';

const MIN_LATENCY_MS = 400;
const MAX_LATENCY_MS = 900;

export interface PolicyDetail {
  policy: Policy;
  customer: Customer;
  claims: readonly Claim[];
  documents: readonly PolicyDocument[];
}

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = 'NotFoundError';
  }
}

/* -------------------------------------------------------------------------- */
/* Transport                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Sleep for a simulated round trip, rejecting if the signal aborts first.
 *
 * The `removeEventListener` in the settle path is not housekeeping. A long-lived
 * `AbortSignal` — the one a `useFetch` hook keeps for a whole route visit —
 * would otherwise accumulate one listener per request, each closing over a
 * resolved promise's scope, and the leak grows for as long as the user stays on
 * the page.
 */
function transport(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('The operation was aborted.', 'AbortError'));
      return;
    }

    const ms = MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS);

    const onAbort = (): void => {
      clearTimeout(timer);
      reject(new DOMException('The operation was aborted.', 'AbortError'));
    };

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Wraps one simulated request. The log line is the observability contract for
 * Phase 4: every real round trip prints exactly one `[api] →`. If a re-render
 * causes a duplicate fetch, it shows up here as a second line for the same
 * path, which is how the promise cache gets proved rather than asserted.
 */
async function request<T>(path: string, signal: AbortSignal | undefined, produce: () => T): Promise<T> {
  console.log(`[api] → ${path}`);
  try {
    await transport(signal);
  } catch (error) {
    console.log(`[api] ✕ ${path} aborted`);
    throw error;
  }
  const result = produce();
  console.log(`[api] ← ${path}`);
  return result;
}

/* -------------------------------------------------------------------------- */
/* Abortable endpoints — the useEffect path                                   */
/* -------------------------------------------------------------------------- */

export function fetchPolicies(signal?: AbortSignal): Promise<readonly Policy[]> {
  return request('GET /policies', signal, () => allPolicies);
}

export function fetchPolicy(id: string, signal?: AbortSignal): Promise<Policy> {
  return request(`GET /policies/${id}`, signal, () => {
    const policy = policiesById.get(id);
    if (!policy) throw new NotFoundError(`Policy ${id}`);
    return policy;
  });
}

export function fetchCustomer(id: string, signal?: AbortSignal): Promise<Customer> {
  return request(`GET /customers/${id}`, signal, () => {
    const customer = customersById.get(id);
    if (!customer) throw new NotFoundError(`Customer ${id}`);
    return customer;
  });
}

export function fetchClaimsForPolicy(
  policyId: string,
  signal?: AbortSignal,
): Promise<readonly Claim[]> {
  return request(`GET /policies/${policyId}/claims`, signal, () => {
    if (!policiesById.has(policyId)) throw new NotFoundError(`Policy ${policyId}`);
    return claimsByPolicyId.get(policyId) ?? [];
  });
}

export function fetchDocumentsForPolicy(
  policyId: string,
  signal?: AbortSignal,
): Promise<readonly PolicyDocument[]> {
  return request(`GET /policies/${policyId}/documents`, signal, () => {
    if (!policiesById.has(policyId)) throw new NotFoundError(`Policy ${policyId}`);
    return documentsByPolicyId.get(policyId) ?? [];
  });
}

export function fetchClaims(signal?: AbortSignal): Promise<readonly Claim[]> {
  return request('GET /claims', signal, () => allClaims);
}

/* -------------------------------------------------------------------------- */
/* Writes                                                                     */
/* -------------------------------------------------------------------------- */

export interface ClaimDraft {
  policyId: string;
  type: Claim['type'];
  amount: number;
  description: string;
}

export interface SubmitClaimOptions {
  signal?: AbortSignal;
  /**
   * Forces the write to fail. Driven by a lab toggle so the optimistic-update
   * rollback (C-05) can be demonstrated on demand instead of being described.
   */
  forceFailure?: boolean;
}

export function submitClaim(draft: ClaimDraft, options: SubmitClaimOptions = {}): Promise<Claim> {
  return request(`POST /policies/${draft.policyId}/claims`, options.signal, () => {
    if (options.forceFailure) {
      throw new Error('Claim intake rejected by the underwriting gateway (simulated failure).');
    }
    if (!policiesById.has(draft.policyId)) throw new NotFoundError(`Policy ${draft.policyId}`);
    return {
      id: `CLM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      policyId: draft.policyId,
      type: draft.type,
      amount: draft.amount,
      status: 'submitted',
      filedAt: new Date().toISOString().slice(0, 10),
      description: draft.description,
    } satisfies Claim;
  });
}

/* -------------------------------------------------------------------------- */
/* The endpoint that always fails                                             */
/* -------------------------------------------------------------------------- */

/**
 * A third-party risk feed that is permanently down.
 *
 * This exists so the scoped error boundary (W3-D4-03) has something real to
 * catch. A boundary tested by a `throw new Error()` typed into a component
 * proves nothing about async failure: the interesting case is a *rejected
 * promise surfacing through Suspense* (W3-D5-04), which needs an endpoint that
 * rejects after a realistic delay rather than synchronously during render.
 */
export function fetchRiskFeed(policyId: string, signal?: AbortSignal): Promise<never> {
  return request(`GET /risk-feed/${policyId}`, signal, (): never => {
    throw new Error(`Risk feed unavailable for ${policyId} (upstream 503).`);
  });
}

/* -------------------------------------------------------------------------- */
/* Cached-promise layer — the use() path                                      */
/* -------------------------------------------------------------------------- */

const policyResourceCache = new Map<string, Promise<PolicyDetail>>();
const riskFeedCache = new Map<string, Promise<never>>();

/**
 * A stable promise per policy id, safe to pass to `use()` during render.
 *
 * Deliberately takes no `AbortSignal`. A cached promise is shared by every
 * component reading it, so letting one consumer abort it would reject the
 * promise for all the others — and because the rejection is cached, the policy
 * would then stay broken for the rest of the session. Cancellation belongs to
 * the abortable path; caching belongs to this one. That is the trade-off the
 * two paths exist to contrast.
 */
export function getPolicyResource(id: string): Promise<PolicyDetail> {
  const cached = policyResourceCache.get(id);
  if (cached) {
    console.log(`[api] ⤳ cache hit /policies/${id}/detail`);
    return cached;
  }

  const promise = request(`GET /policies/${id}/detail`, undefined, (): PolicyDetail => {
    const policy = policiesById.get(id);
    if (!policy) throw new NotFoundError(`Policy ${id}`);
    const customer = customersById.get(policy.customerId);
    if (!customer) throw new NotFoundError(`Customer ${policy.customerId}`);
    return {
      policy,
      customer,
      claims: claimsByPolicyId.get(id) ?? [],
      documents: documentsByPolicyId.get(id) ?? [],
    };
  });

  policyResourceCache.set(id, promise);
  return promise;
}

/** Cached counterpart of `fetchRiskFeed`, for the Suspense + boundary demo. */
export function getRiskFeedResource(policyId: string): Promise<never> {
  const cached = riskFeedCache.get(policyId);
  if (cached) return cached;
  const promise = fetchRiskFeed(policyId);
  // Nothing else attaches a handler until `use()` does, and an unhandled
  // rejection warning in the console would be mistaken for a real bug during
  // the demo.
  promise.catch(() => undefined);
  riskFeedCache.set(policyId, promise);
  return promise;
}

/**
 * Evict one policy from the cache.
 *
 * The error boundary's Retry button must call this. Clearing the boundary's
 * own error state is not enough: the rejected promise is still sitting in this
 * Map, so the remounted child calls `getPolicyResource(id)`, gets the *same
 * rejected promise* back, and throws again immediately. The retry button would
 * appear to do nothing.
 */
export function clearPolicyResource(id: string): void {
  policyResourceCache.delete(id);
  riskFeedCache.delete(id);
  console.log(`[api] ⌫ evicted cache for ${id}`);
}

export function clearResourceCache(): void {
  policyResourceCache.clear();
  riskFeedCache.clear();
  console.log('[api] ⌫ cleared resource cache');
}
