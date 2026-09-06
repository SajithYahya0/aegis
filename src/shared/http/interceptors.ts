/**
 * WHY THIS EXISTS:
 *   Everything that happens to a request that is not the request itself:
 *   attaching the bearer token, stamping a correlation id and a start time,
 *   logging the round trip, turning every possible failure into one error
 *   type, and recovering from a 401 by refreshing the session exactly once no
 *   matter how many requests hit the expired token at the same time.
 *
 *   Three interceptors, registered separately rather than as one
 *   `use(onSuccess, onError)` pair, because they answer three different
 *   questions and are meant to be defended one at a time.
 *
 * CONCEPTS: W4-D3-02, W4-D3-03, W4-D3-04
 *
 * WITHOUT THIS:
 *   (a) No request interceptor: every call site attaches its own
 *   `Authorization` header. The Claims tab's fetcher, the claim write and
 *   every future endpoint each need to import the token store, and the day
 *   one of them forgets, the failure is a 401 on one screen only — the
 *   hardest kind to notice, because the other twenty screens work. There is
 *   also no correlation id, so the `[api]` line the backend prints and the
 *   `[http]` line the client prints cannot be tied to each other once two
 *   requests overlap, which is exactly when reading the log matters.
 *
 *   (b) No success interceptor: nothing records how long anything took.
 *   "The Claims tab feels slow" stays an opinion — there is no elapsed-ms
 *   number to compare against the 400-900ms the backend admits to, so a
 *   duplicated request (two round trips where the user perceives one) reads
 *   identically to a single slow one.
 *
 *   (c) No error interceptor: the UI has to handle three unrelated shapes for
 *   what a user experiences as one thing. An `AxiosError` with a `response`
 *   (the server said 503), an `AxiosError` with no `response` (timeout,
 *   `ECONNABORTED`), and a thrown `CanceledError` (the user navigated away)
 *   all reach `catch` blocks that then each decide, differently, what to put
 *   on screen. `PolicyClaimsTab` renders `error.message`; without
 *   normalisation that is "Request failed with status code 503" — the
 *   transport's words, not the server's — while the actual message the
 *   backend sent sits unread in `error.response.data.message`.
 *
 *   And without the single-flight refresh: three requests hitting an expired
 *   token fire three `POST /auth/refresh` calls. Each one rotates the refresh
 *   token, so the second and third present a token the first already spent —
 *   two of them fail, and which one survives is a race. The user is logged out
 *   by their own retry. The `_retry` flag is the other half: a replay that
 *   401s again must be allowed to fail, or a genuinely dead session refreshes,
 *   replays, 401s and refreshes again without bound.
 */

import axios, { isAxiosError, type AxiosError, type AxiosInstance } from 'axios';
import { clearTokens, getAccessToken, getRefreshToken, setTokens, type TokenPair } from './tokenStore';

/** Endpoints that must not have a token attached — see `ensureAccessToken`. */
const AUTH_PATH = /^\/auth\//;

const CORRELATION_HEADER = 'x-correlation-id';

/** Demo session. There is no login screen; the identity is fixed. */
const DEMO_LOGIN = { username: 'priya.nair', role: 'agent' } as const;

/* -------------------------------------------------------------------------- */
/* The one error type                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Every failure that leaves this module is one of these, whatever it was on
 * the way in.
 *
 * `status` is 0 for failures that never got a response (timeout, cancellation)
 * rather than `undefined`, so a consumer can compare it without a null check
 * and `status >= 500` never silently means "no response".
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly correlationId: string;

  constructor(init: { status: number; code: string; message: string; correlationId: string }) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.correlationId = init.correlationId;
  }

  /**
   * True when the caller aborted the request itself. Kept as a flag on the one
   * error type rather than by letting `CanceledError` through unwrapped: a
   * consumer that has to ask `axios.isCancel(e) || e instanceof ApiError` is
   * back to branching on transport internals, which is the thing this class
   * exists to stop.
   */
  get canceled(): boolean {
    return this.code === 'ERR_CANCELED';
  }
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

let correlationSeq = 0;

/**
 * A short, ordered id rather than a UUID. Both are unique enough for one tab;
 * only one of them can be read at a glance in a console where three requests
 * and a refresh are interleaved, which is the entire reason it is printed.
 */
function newCorrelationId(): string {
  correlationSeq += 1;
  return `req-${String(correlationSeq).padStart(4, '0')}`;
}

function isAuthEndpoint(url: string | undefined): boolean {
  return AUTH_PATH.test(url ?? '');
}

/** Server-supplied `{ code, message }`, when the response body carries one. */
function bodyFields(data: unknown): { code?: string; message?: string } {
  if (typeof data !== 'object' || data === null) return {};
  const record = data as Record<string, unknown>;
  return {
    code: typeof record.code === 'string' ? record.code : undefined,
    message: typeof record.message === 'string' ? record.message : undefined,
  };
}

function normalise(error: AxiosError): ApiError {
  const correlationId = error.config?.meta?.correlationId ?? 'req-????';

  if (axios.isCancel(error)) {
    return new ApiError({
      status: 0,
      code: 'ERR_CANCELED',
      message: 'Request canceled by the caller.',
      correlationId,
    });
  }

  if (!error.response) {
    return new ApiError({
      status: 0,
      code: error.code ?? 'ERR_NETWORK',
      message:
        error.code === 'ECONNABORTED'
          ? 'The server did not respond in time.'
          : (error.message || 'The request could not be sent.'),
      correlationId,
    });
  }

  const { code, message } = bodyFields(error.response.data);
  return new ApiError({
    status: error.response.status,
    // The server's own words first. `error.message` is the transport's
    // ("Request failed with status code 503"), which is true and useless.
    code: code ?? `HTTP_${error.response.status}`,
    message: message ?? error.message,
    correlationId,
  });
}

/* -------------------------------------------------------------------------- */
/* Install                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Registers the three interceptors on `instance` and returns a function that
 * removes them again.
 *
 * The two in-flight promises below are per-install, not per-module, so a test
 * that builds its own instance starts with no session and no refresh in
 * progress — otherwise the first test to log in would leave a token behind
 * that makes the second test's "does it attach a token" assertion pass for
 * the wrong reason.
 */
export function installInterceptors(instance: AxiosInstance): () => void {
  /** The bootstrap `POST /auth/login`, shared by everything waiting on it. */
  let sessionPromise: Promise<string> | null = null;
  /** The in-flight `POST /auth/refresh`. This is the single-flight queue. */
  let refreshPromise: Promise<string> | null = null;

  async function login(): Promise<string> {
    const response = await instance.post<TokenPair>('/auth/login', DEMO_LOGIN);
    setTokens(response.data);
    return response.data.accessToken;
  }

  /**
   * The token to attach, logging in first if this is the session's very first
   * request.
   *
   * Concurrent callers share one login for the same reason they share one
   * refresh: the Claims tab mounting fires its GET while nothing has a token
   * yet, and a second request in the same tick must queue behind that login
   * rather than start its own and overwrite the tokens the first one stored.
   *
   * This is also why `/auth/*` requests skip the interceptor's token attach
   * entirely: the login request goes through this same instance, so asking it
   * to wait for a token would mean waiting for itself.
   */
  function ensureAccessToken(): Promise<string> {
    const existing = getAccessToken();
    if (existing) return Promise.resolve(existing);

    sessionPromise ??= login().finally(() => {
      sessionPromise = null;
    });
    return sessionPromise;
  }

  /**
   * Refreshes the session at most once at a time.
   *
   * Every 401 that arrives while a refresh is in flight joins the existing
   * promise instead of starting a second one — that is the whole queue. There
   * is no array of pending requests to replay by hand: each 401 is already
   * sitting in its own `await` inside the error interceptor, and resuming it
   * when this promise settles replays it in place.
   */
  function refreshOnce(): Promise<string> {
    if (refreshPromise) {
      console.log('[auth] ⇢ joining the in-flight refresh');
      return refreshPromise;
    }

    console.log('[auth] ↻ refreshing session');
    refreshPromise = (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        throw new ApiError({
          status: 401,
          code: 'NO_REFRESH_TOKEN',
          message: 'Session expired and there is no refresh token to renew it with.',
          correlationId: 'req-????',
        });
      }

      try {
        const response = await instance.post<TokenPair>('/auth/refresh', { refreshToken });
        setTokens(response.data);
        return response.data.accessToken;
      } catch (error) {
        // A refused refresh is terminal. Leaving the dead tokens in place
        // would have the next request attach them, 401, and refresh again.
        clearTokens();
        throw error instanceof ApiError
          ? error
          : new ApiError({
              status: 401,
              code: 'REFRESH_FAILED',
              message: 'Session expired.',
              correlationId: 'req-????',
            });
      }
    })().finally(() => {
      refreshPromise = null;
    });

    return refreshPromise;
  }

  /* ---- (a) REQUEST: identity and traceability ---------------------------- */

  const requestId = instance.interceptors.request.use(async (config) => {
    // Reused rather than regenerated when this config is a 401 replay, so the
    // retry prints the same id as the attempt it is retrying.
    const correlationId = config.meta?.correlationId ?? newCorrelationId();
    config.meta = { correlationId, startedAt: now() };
    config.headers.set(CORRELATION_HEADER, correlationId);

    if (!isAuthEndpoint(config.url)) {
      config.headers.set('Authorization', `Bearer ${await ensureAccessToken()}`);
    }

    return config;
  });

  /* ---- (b) RESPONSE (success): what happened, and how long it took -------- */

  const successId = instance.interceptors.response.use((response) => {
    const meta = response.config.meta;
    const elapsed = meta ? Math.round(now() - meta.startedAt) : -1;
    const method = (response.config.method ?? 'get').toUpperCase();
    console.log(
      `[http] ← ${method} ${response.config.url} ${response.status} ${elapsed}ms ${meta?.correlationId ?? ''}`,
    );
    return response;
  });

  /* ---- (c) RESPONSE (error): one error shape, and the 401 recovery -------- */

  const errorId = instance.interceptors.response.use(undefined, async (error: unknown) => {
    if (!isAxiosError(error)) {
      throw new ApiError({
        status: 0,
        code: 'ERR_UNEXPECTED',
        message: error instanceof Error ? error.message : String(error),
        correlationId: 'req-????',
      });
    }

    const config = error.config;
    const meta = config?.meta;
    const elapsed = meta ? Math.round(now() - meta.startedAt) : -1;
    const method = (config?.method ?? 'get').toUpperCase();
    const status = error.response?.status ?? 0;

    const outcome = axios.isCancel(error) ? 'canceled' : status || 'no response';
    console.log(
      `[http] ✕ ${method} ${config?.url} ${outcome} ${elapsed}ms ${meta?.correlationId ?? ''}`,
    );

    const refreshable =
      status === 401 && config !== undefined && config._retry !== true && !isAuthEndpoint(config.url);

    if (refreshable) {
      // Set before awaiting: the replay carries the flag, so if it 401s too
      // this branch is not taken a second time and the error falls through to
      // the normalisation below. That is the loop guard.
      config._retry = true;
      await refreshOnce();
      console.log(`[http] ↻ replaying ${method} ${config.url} ${meta?.correlationId ?? ''}`);
      return instance.request(config);
    }

    throw normalise(error);
  });

  return () => {
    instance.interceptors.request.eject(requestId);
    instance.interceptors.response.eject(successId);
    instance.interceptors.response.eject(errorId);
  };
}
