/**
 * WHY THIS EXISTS:
 *   The server side of the axios stack. `axios-mock-adapter` replaces the
 *   instance's transport adapter, so requests are dispatched by axios for
 *   real — through every interceptor, with a real config, a real response and
 *   real error statuses — and are answered here from `src/shared/data`
 *   instead of over the wire.
 *
 * CONCEPTS: W4-D3-01, W4-D3-03, W4-D3-04, W4-D3-05
 *
 * WITHOUT THIS:
 *   There is no `/api` to talk to. StackBlitz's preview serves static files,
 *   so every request 404s at the dev server, every response the interceptors
 *   see is the same HTML error page, and the 401 refresh flow — the one
 *   mechanism in this folder that cannot be demonstrated by reading the code
 *   — has nothing to demonstrate it against.
 *
 *   Stubbing the *endpoint functions* instead (returning data from a promise
 *   and skipping axios) is the tempting shortcut and it is the one thing that
 *   would make this folder worthless: the interceptors would never execute, so
 *   "the token is attached to every request" and "concurrent 401s trigger one
 *   refresh" would be claims about code nothing runs. Mocking at the *adapter*
 *   is what keeps them observable — a burst of 401s here really does queue,
 *   really does produce one `POST /auth/refresh`, and really does replay.
 *
 *   The 400-900ms latency is not decoration. Without it every request settles
 *   in the same microtask, so nothing is ever in flight when the next thing
 *   happens: the optimistic claim row (C-05) never renders its pending state,
 *   `useFetch`'s abort (W4-D3-05) has nothing to cancel, and the concurrent
 *   401 burst resolves one at a time instead of overlapping — which is
 *   precisely the case the single-flight queue exists for.
 *
 *   The auth check runs before the latency, deliberately: a rejected token is
 *   decided before any work is done, so the 401 comes back immediately and a
 *   burst of parallel requests reaches the interceptor as a burst rather than
 *   spread across a random 500ms window.
 */

import {
  AxiosHeaders,
  CanceledError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import MockAdapter from 'axios-mock-adapter';
import {
  claims as allClaims,
  claimsByPolicyId,
  documentsByPolicyId,
  policies as allPolicies,
  policiesById,
} from '../data';
import { isLabEnabled, setLabEnabled } from '../labs/registry';
// Type-only, so it adds no runtime edge: the response shapes are the client's
// contract (`endpoints.ts`) and this file is one implementation of it.
import type {
  UnderwritingDecision,
  UnderwritingDecisionOutcome,
  UnderwritingLimits,
} from './endpoints';
import type { Claim, ClaimType } from '../types';

const MIN_LATENCY_MS = 400;
const MAX_LATENCY_MS = 900;

export interface MockBackendOptions {
  /**
   * Simulated round-trip time, in ms. Exists so the test suite can run the
   * same handlers at 10ms instead of 900ms — those tests are about ordering
   * (one refresh, two attempts), not about duration.
   */
  latencyMs?: () => number;
}

/** `[status, body, headers?]` — the shape `axios-mock-adapter` replies with. */
type Reply = [number, unknown, Record<string, string>?];

/* -------------------------------------------------------------------------- */
/* Request helpers                                                            */
/* -------------------------------------------------------------------------- */

/** The path as written by the caller, with `baseURL` removed if axios added it. */
function pathOf(config: AxiosRequestConfig): string {
  const url = config.url ?? '';
  const base = config.baseURL ?? '';
  return base && url.startsWith(base) ? url.slice(base.length) : url;
}

function methodOf(config: AxiosRequestConfig): string {
  return (config.method ?? 'get').toUpperCase();
}

function headerValue(config: AxiosRequestConfig, name: string): string | undefined {
  const headers = config.headers;
  if (!headers) return undefined;

  if (headers instanceof AxiosHeaders) {
    const value = headers.get(name);
    return typeof value === 'string' ? value : undefined;
  }

  const record: Record<string, unknown> = headers;
  const key = Object.keys(record).find((k) => k.toLowerCase() === name.toLowerCase());
  const value = key === undefined ? undefined : record[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Request bodies arrive as the JSON *string* axios serialised, because the
 * adapter is swapped in below the transform pipeline — the same place a real
 * network adapter sits. Parsing it here rather than reading `config.data` as
 * an object is what keeps this backend honest about what a server receives.
 */
function bodyOf(config: AxiosRequestConfig): Record<string, unknown> {
  if (typeof config.data !== 'string' || config.data.length === 0) return {};
  try {
    const parsed: unknown = JSON.parse(config.data);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function correlationHeaders(config: AxiosRequestConfig): Record<string, string> {
  const cid = headerValue(config, 'x-correlation-id');
  return cid ? { 'x-correlation-id': cid } : {};
}

/**
 * Sleeps for the simulated round trip and rejects if the caller's
 * `AbortSignal` fires first.
 *
 * `axios-mock-adapter` does not look at `config.signal` at all — it settles on
 * a bare `setTimeout` — so without this the Claims tab's cleanup would abort a
 * request that goes on to resolve anyway, and W4-D3-05 would be a claim with
 * nothing behind it. Rejecting with axios's own `CanceledError` is what makes
 * `axios.isCancel(error)` true downstream, so the error interceptor can tell
 * "the user navigated away" apart from "the server failed".
 *
 * The `removeEventListener` on the settle path matters for the same reason it
 * does in `src/shared/api.ts`: one listener per request accumulates on a
 * long-lived signal for as long as the user stays on the page.
 */
function delay(ms: number, config: AxiosRequestConfig): Promise<void> {
  const signal = config.signal;

  // The error carries the config, and that is not cosmetic: the response error
  // interceptor reads `error.config.meta` for the correlation id and the start
  // time. A bare `new CanceledError()` logs `✕ GET undefined canceled -1ms`
  // and normalises to an `ApiError` whose correlationId is a placeholder —
  // the one line in the log that would tell you *which* of three in-flight
  // requests was the one abandoned.
  //
  // The cast narrows what the adapter was already handed: at runtime axios
  // always passes the internal config down to its adapter; only
  // `axios-mock-adapter`'s own type declaration widens it back to
  // `AxiosRequestConfig` on the way into a handler.
  const canceled = (): CanceledError<unknown> =>
    new CanceledError('canceled', config as InternalAxiosRequestConfig);

  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(canceled());
      return;
    }

    const onAbort = (): void => {
      clearTimeout(timer);
      reject(canceled());
    };

    const timer = setTimeout(() => {
      signal?.removeEventListener?.('abort', onAbort);
      resolve();
    }, ms);

    signal?.addEventListener?.('abort', onAbort);
  });
}

/* -------------------------------------------------------------------------- */
/* Routes                                                                     */
/* -------------------------------------------------------------------------- */

const ROUTE = {
  policies: /^\/policies$/,
  policy: /^\/policies\/([^/]+)$/,
  policyClaims: /^\/policies\/([^/]+)\/claims$/,
  policyDocuments: /^\/policies\/([^/]+)\/documents$/,
  claims: /^\/claims$/,
  riskFeed: /^\/risk-feed\/([^/]+)$/,
  underwritingLimits: /^\/underwriting\/limits$/,
  underwritingDecisions: /^\/underwriting\/decisions$/,
  login: /^\/auth\/login$/,
  refresh: /^\/auth\/refresh$/,
} as const;

/**
 * The server's own copy of the note rule. It is deliberately *stricter than
 * nothing and looser than the client's*: `decisionSchema.ts` asks for 20
 * characters, this asks for 10.
 *
 * That gap is the point. A client-side-only rule is a suggestion — anything
 * that can reach the endpoint can skip it — so the endpoint states its own
 * minimum, and the two numbers are different so that a reviewer can tell which
 * one rejected a given attempt from the message alone.
 */
const MIN_SERVER_NOTE_CHARS = 10;

function idFrom(config: AxiosRequestConfig, pattern: RegExp): string {
  return pattern.exec(pathOf(config))?.[1] ?? '';
}

function notFound(what: string): Reply {
  return [404, { code: 'NOT_FOUND', message: `${what} not found` }];
}

/* -------------------------------------------------------------------------- */
/* Install                                                                    */
/* -------------------------------------------------------------------------- */

export function installMockBackend(
  instance: AxiosInstance,
  options: MockBackendOptions = {},
): MockAdapter {
  const latencyMs =
    options.latencyMs ?? (() => MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS));

  // Session state, scoped to this install rather than to the module: a test
  // that builds its own instance gets its own empty sets, so one test's
  // revoked token cannot fail the next test's first request.
  const revokedAccessTokens = new Set<string>();
  const liveRefreshTokens = new Set<string>();
  let issued = 0;

  function issueTokens(subject: string): { accessToken: string; refreshToken: string } {
    issued += 1;
    const pair = {
      accessToken: `at-${issued}-${subject}`,
      refreshToken: `rt-${issued}-${subject}`,
    };
    liveRefreshTokens.add(pair.refreshToken);
    return pair;
  }

  /**
   * Returns a 401 reply, or `null` if the request may proceed.
   *
   * The `expire-token` lab defect fires here and is one-shot on purpose: it
   * revokes whatever token the *next* request presents and then switches
   * itself off. Revoking the token rather than simply answering 401 once is
   * what makes a burst work — every parallel request in flight is carrying
   * that same token, so they all come back 401 and the interceptor's queue has
   * something real to collapse. Leaving the toggle on instead would 401 the
   * replayed requests too, and the demo would end in a failure rather than in
   * a recovery.
   */
  function unauthorized(config: AxiosRequestConfig): Reply | null {
    const presented = headerValue(config, 'Authorization')?.replace(/^Bearer\s+/i, '') ?? '';

    if (isLabEnabled('expire-token')) {
      setLabEnabled('expire-token', false);
      if (presented) revokedAccessTokens.add(presented);
      console.log(`[api] ✕ ${methodOf(config)} ${pathOf(config)} 401 (lab: expire-token)`);
      return [
        401,
        { code: 'TOKEN_EXPIRED', message: 'Access token expired.' },
        correlationHeaders(config),
      ];
    }

    if (!presented) {
      console.log(`[api] ✕ ${methodOf(config)} ${pathOf(config)} 401 (no token)`);
      return [401, { code: 'NO_TOKEN', message: 'Missing bearer token.' }, correlationHeaders(config)];
    }

    if (revokedAccessTokens.has(presented)) {
      console.log(`[api] ✕ ${methodOf(config)} ${pathOf(config)} 401 (revoked token)`);
      return [
        401,
        { code: 'TOKEN_EXPIRED', message: 'Access token expired.' },
        correlationHeaders(config),
      ];
    }

    return null;
  }

  /**
   * Wraps one authenticated request: auth check first (no latency — see the
   * file header), then the simulated round trip, then the data. The `[api] →`
   * / `[api] ←` pair is the same observability contract `src/shared/api.ts`
   * prints, so a duplicated request still shows up as a second `→` line for
   * the same path no matter which of the two transports made it.
   */
  async function serve(config: AxiosRequestConfig, produce: () => Reply): Promise<Reply> {
    const label = `${methodOf(config)} ${pathOf(config)}`;
    console.log(`[api] → ${label}`);

    const rejection = unauthorized(config);
    if (rejection) return rejection;

    try {
      await delay(latencyMs(), config);
    } catch (error) {
      console.log(`[api] ✕ ${label} aborted`);
      throw error;
    }

    const [status, body] = produce();
    console.log(`[api] ${status >= 400 ? '✕' : '←'} ${label} ${status}`);
    return [status, body, correlationHeaders(config)];
  }

  const mock = new MockAdapter(instance);

  mock.onGet(ROUTE.policies).reply((config) => serve(config, () => [200, allPolicies]));

  mock.onGet(ROUTE.policy).reply((config) =>
    serve(config, () => {
      const id = idFrom(config, ROUTE.policy);
      const policy = policiesById.get(id);
      return policy ? [200, policy] : notFound(`Policy ${id}`);
    }),
  );

  mock.onGet(ROUTE.policyClaims).reply((config) =>
    serve(config, () => {
      const id = idFrom(config, ROUTE.policyClaims);
      if (!policiesById.has(id)) return notFound(`Policy ${id}`);
      return [200, claimsByPolicyId.get(id) ?? []];
    }),
  );

  mock.onGet(ROUTE.policyDocuments).reply((config) =>
    serve(config, () => {
      const id = idFrom(config, ROUTE.policyDocuments);
      if (!policiesById.has(id)) return notFound(`Policy ${id}`);
      return [200, documentsByPolicyId.get(id) ?? []];
    }),
  );

  mock.onPost(ROUTE.policyClaims).reply((config) =>
    serve(config, () => {
      const id = idFrom(config, ROUTE.policyClaims);
      const body = bodyOf(config);

      // Mirrors `submitClaim`'s `forceFailure` option in `src/shared/api.ts`:
      // the `claim-submit-failure` lab toggle (C-05) has to be able to reject
      // the write through this transport too, or moving the Claims tab onto
      // axios would quietly delete a registered defect's demo.
      if (body.forceFailure === true) {
        return [
          502,
          {
            code: 'GATEWAY_REJECTED',
            message: 'Claim intake rejected by the underwriting gateway (simulated failure).',
          },
        ];
      }

      if (!policiesById.has(id)) return notFound(`Policy ${id}`);

      const claim: Claim = {
        id: `CLM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        policyId: id,
        type: body.type as ClaimType,
        amount: Number(body.amount),
        status: 'submitted',
        filedAt: new Date().toISOString().slice(0, 10),
        description: String(body.description ?? ''),
      };
      return [201, claim];
    }),
  );

  /*
   * The whole claims history, unscoped. `/underwriting` needs it to compute a
   * loss ratio per policy, and it asks for it as one request rather than 140
   * `GET /policies/:id/claims` calls — which is also what makes the referral
   * queue a *burst* of three parallel requests rather than a waterfall of
   * hundreds. See `UnderwritingPage.tsx`'s header.
   */
  mock.onGet(ROUTE.claims).reply((config) => serve(config, () => [200, allClaims]));

  /**
   * The branch's authority limits, read off the presented token rather than off
   * a request parameter.
   *
   * `issueTokens` stamps the role into the access token (`at-3-underwriter`),
   * so this is the one endpoint where the request interceptor's work is
   * *visible in the response body*: change role in the AppBar, the store
   * re-authenticates, the interceptor attaches the new token, and this handler
   * answers with a different auto-bind limit. A `?role=` query parameter would
   * look identical on screen and would let any caller ask for an authority it
   * does not hold.
   */
  mock.onGet(ROUTE.underwritingLimits).reply((config) =>
    serve(config, () => {
      const presented = headerValue(config, 'Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
      const isUnderwriter = presented.endsWith('-underwriter');
      const limits: UnderwritingLimits = isUnderwriter
        ? { autoBindLimit: 2_500_000, maxLoadingPct: 40, referralLossRatio: 0.7 }
        : { autoBindLimit: 500_000, maxLoadingPct: 10, referralLossRatio: 0.5 };
      return [200, limits];
    }),
  );

  /**
   * Records an underwriting decision. Validates the note server-side — see
   * `MIN_SERVER_NOTE_CHARS` — so the form has a real 422 to surface rather
   * than an endpoint that accepts anything the client happened to send.
   */
  mock.onPost(ROUTE.underwritingDecisions).reply((config) =>
    serve(config, () => {
      const body = bodyOf(config);
      const policyId = String(body.policyId ?? '');
      const note = String(body.note ?? '').trim();

      if (!policiesById.has(policyId)) return notFound(`Policy ${policyId}`);

      if (note.length < MIN_SERVER_NOTE_CHARS) {
        return [
          422,
          {
            code: 'NOTE_TOO_SHORT',
            message: `The underwriting note must be at least ${MIN_SERVER_NOTE_CHARS} characters (server rule).`,
          },
        ];
      }

      const presented = headerValue(config, 'Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
      const decision: UnderwritingDecision = {
        id: `UWD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        policyId,
        outcome: body.outcome as UnderwritingDecisionOutcome,
        loadingPct: Number(body.loadingPct ?? 0),
        note,
        decidedAt: new Date().toISOString(),
        decidedBy: presented || 'anonymous',
      };
      return [201, decision];
    }),
  );

  /**
   * The endpoint that is always down — the axios-side counterpart of `api.ts`'s
   * `fetchRiskFeed`. A 503 that arrives as a real HTTP status (rather than as a
   * thrown JS error) is what the response error interceptor needs in order to
   * prove it normalises *transport* failures, not just exceptions it threw
   * itself.
   */
  mock.onGet(ROUTE.riskFeed).reply((config) =>
    serve(config, () => {
      const id = idFrom(config, ROUTE.riskFeed);
      return [
        503,
        {
          code: 'RISK_FEED_UNAVAILABLE',
          message: `Risk feed unavailable for ${id} (upstream 503).`,
        },
      ];
    }),
  );

  mock.onPost(ROUTE.login).reply(async (config) => {
    const label = `${methodOf(config)} ${pathOf(config)}`;
    console.log(`[api] → ${label}`);
    await delay(latencyMs(), config);
    const role = String(bodyOf(config).role ?? 'agent');
    const pair = issueTokens(role);
    console.log(`[api] ← ${label} 200 (issued ${pair.accessToken})`);
    return [200, pair, correlationHeaders(config)];
  });

  /**
   * Trades a live refresh token for a new pair. Rejecting an unknown or
   * already-spent refresh token is what gives the interceptor a terminal
   * failure to surface: without it, a session whose refresh token is gone
   * would keep being handed new access tokens and the "your session ended"
   * path would never be reachable.
   */
  mock.onPost(ROUTE.refresh).reply(async (config) => {
    const label = `${methodOf(config)} ${pathOf(config)}`;
    console.log(`[api] → ${label}`);
    await delay(latencyMs(), config);

    const presented = String(bodyOf(config).refreshToken ?? '');
    if (!liveRefreshTokens.has(presented)) {
      console.log(`[api] ✕ ${label} 401 (refresh token rejected)`);
      return [
        401,
        { code: 'REFRESH_REJECTED', message: 'Refresh token is not valid.' },
        correlationHeaders(config),
      ];
    }

    liveRefreshTokens.delete(presented);
    const pair = issueTokens('refreshed');
    console.log(`[api] ← ${label} 200 (issued ${pair.accessToken})`);
    return [200, pair, correlationHeaders(config)];
  });

  return mock;
}
