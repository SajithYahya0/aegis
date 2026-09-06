/**
 * WHY THIS EXISTS:
 *   Pins the four things about this folder that cannot be seen by reading it,
 *   and that a live click-through can only partly show: that a token is
 *   attached to every request, that a *burst* of concurrent 401s produces
 *   exactly one refresh, that a replay which 401s again stops instead of
 *   looping, and that an abort really reaches the transport.
 *
 * CONCEPTS: W4-D3-02, W4-D3-03, W4-D3-04, W4-D3-05
 *
 * WITHOUT THIS:
 *   The single-flight refresh is the kind of code that looks right and is
 *   wrong under exactly one condition — several requests failing at the same
 *   moment — which is the condition no manual demo reliably produces. The
 *   `expire-token` lab toggle shows the recovery for one request; only a test
 *   can fire three at once and then count that there was one `POST
 *   /auth/refresh` and not three. Three refreshes is not a slow path, it is a
 *   logout: each refresh rotates the token, so the second and third present
 *   one the first already spent.
 *
 *   The retry guard is worse to leave untested, because its failure mode is
 *   unbounded: a session the server will never accept again would refresh,
 *   replay, 401, and refresh forever. The test below asserts the exact
 *   counts — two attempts, one refresh — so a future edit that drops the
 *   `_retry` flag fails here instead of in a browser tab pinned at 100% CPU.
 *
 *   These also cover the mock backend routes that no component calls yet
 *   (`GET /policies`, `GET /risk-feed/:id`), which is the honest reason they
 *   are exercised here rather than left as handlers nothing has ever run.
 */

import axios, { type AxiosInstance } from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { afterEach, describe, expect, it } from 'vitest';
import { ApiError, installInterceptors } from './interceptors';
import { installMockBackend } from './mockBackend';
import { makeStore, type AppStore } from '../store';
import { setLabEnabled } from '../labs/registry';
import type { Claim, Policy } from '../types';

interface Stack {
  instance: AxiosInstance;
  mock: MockAdapter;
  store: AppStore;
  uninstall: () => void;
}

const teardowns: Array<() => void> = [];

/**
 * A private stack per test: its own instance, its own backend session state,
 * and — since the session moved into Redux — its own store.
 *
 * The store is the reason `installInterceptors` takes one at all. Left to the
 * app's singleton, the token minted by the first test would still be sitting
 * in `state.auth` when the second ran, and "logs in once and attaches the
 * bearer token" would pass without a login ever happening. It also keeps the
 * thunks pointed at *this* instance: `makeStore` hands `{ http: instance }` to
 * the thunk middleware as its extra argument, so `POST /auth/login` from
 * inside `loginThunk` lands on the mock backend this test owns.
 */
function makeStack(latency = 20): Stack {
  const instance = axios.create({ baseURL: '/api', timeout: 8000 });
  // 20ms instead of 400-900ms: these tests are about ordering and counts, and
  // the abort test still needs a window in which something is in flight.
  const mock = installMockBackend(instance, { latencyMs: () => latency });
  const store = makeStore({ http: instance });
  const uninstall = installInterceptors(instance, store);
  const stack: Stack = { instance, mock, store, uninstall };
  teardowns.push(() => {
    uninstall();
    mock.restore();
  });
  return stack;
}

function postsTo(mock: MockAdapter, url: string): number {
  return mock.history.post.filter((config) => config.url === url).length;
}

afterEach(() => {
  while (teardowns.length > 0) teardowns.pop()?.();
  // No token teardown any more: the session lives in a store built per stack,
  // so it is discarded with the stack. This used to be a `clearTokens()` call
  // against module state shared by every test — the kind of cleanup that is
  // invisible when it is forgotten and mystifying when it is not.
  setLabEnabled('expire-token', false);
});

describe('request interceptor', () => {
  it('logs in once and attaches the bearer token and a correlation id', async () => {
    const { instance, mock } = makeStack();

    const response = await instance.get<Policy[]>('/policies');

    expect(response.status).toBe(200);
    expect(response.data.length).toBeGreaterThan(0);
    expect(postsTo(mock, '/auth/login')).toBe(1);

    const sent = mock.history.get.find((config) => config.url === '/policies');
    expect(sent?.headers?.Authorization).toMatch(/^Bearer at-\d+-agent$/);
    expect(sent?.headers?.['x-correlation-id']).toMatch(/^req-\d{4}$/);
  });

  it('does not attach a token to the login request itself', async () => {
    const { instance, mock } = makeStack();

    await instance.get('/policies');

    const login = mock.history.post.find((config) => config.url === '/auth/login');
    expect(login?.headers?.Authorization).toBeUndefined();
  });

  it('shares one login across requests fired before any token exists', async () => {
    const { instance, mock } = makeStack();

    await Promise.all([
      instance.get('/policies'),
      instance.get('/policies'),
      instance.get('/policies'),
    ]);

    expect(postsTo(mock, '/auth/login')).toBe(1);
  });
});

describe('response error interceptor', () => {
  it('normalises an upstream 503 into an ApiError carrying the server’s own code and message', async () => {
    const { instance } = makeStack();

    const error = await instance.get('/risk-feed/POL-00001').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(503);
    expect(apiError.code).toBe('RISK_FEED_UNAVAILABLE');
    expect(apiError.message).toContain('Risk feed unavailable');
    expect(apiError.correlationId).toMatch(/^req-\d{4}$/);
    expect(apiError.canceled).toBe(false);
  });

  it('normalises a 404 the same way', async () => {
    const { instance } = makeStack();

    const error = await instance.get('/policies/NOT-A-POLICY/claims').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
    expect((error as ApiError).code).toBe('NOT_FOUND');
  });
});

describe('401 refresh', () => {
  it('refreshes once for a burst of concurrent 401s and replays every request', async () => {
    const { instance, mock } = makeStack();

    // Establish a session, then expire the token it just issued.
    const policies = await instance.get<Policy[]>('/policies');
    const [first, second] = policies.data;
    setLabEnabled('expire-token', true);

    const [claimsA, claimsB, all] = await Promise.all([
      instance.get<Claim[]>(`/policies/${first.id}/claims`),
      instance.get<Claim[]>(`/policies/${second.id}/claims`),
      instance.get<Policy[]>('/policies'),
    ]);

    // Every request succeeded, and exactly one refresh was made for all three.
    expect(claimsA.status).toBe(200);
    expect(claimsB.status).toBe(200);
    expect(all.status).toBe(200);
    expect(postsTo(mock, '/auth/refresh')).toBe(1);
    expect(postsTo(mock, '/auth/login')).toBe(1);

    // Each of the three was attempted twice: once with the expired token,
    // once replayed with the refreshed one.
    expect(mock.history.get.filter((c) => c.url === `/policies/${first.id}/claims`)).toHaveLength(2);

    // The replay carries the id of the attempt it is retrying, not a new one.
    const attempts = mock.history.get.filter((c) => c.url === `/policies/${first.id}/claims`);
    expect(attempts[0]?.headers?.['x-correlation-id']).toBe(
      attempts[1]?.headers?.['x-correlation-id'],
    );
    // ...and a different token.
    expect(attempts[0]?.headers?.Authorization).not.toBe(attempts[1]?.headers?.Authorization);
  });

  it('gives up after one replay instead of refreshing forever', async () => {
    // A hand-built backend rather than the app's: this needs an endpoint that
    // answers 401 no matter which token it is shown, which is a server the
    // demo deliberately does not have.
    const instance = axios.create({ baseURL: '/api' });
    const mock = new MockAdapter(instance);
    mock.onPost('/auth/login').reply(200, { accessToken: 'at-1', refreshToken: 'rt-1' });
    mock.onPost('/auth/refresh').reply(200, { accessToken: 'at-2', refreshToken: 'rt-2' });
    mock.onGet('/vault').reply(401, { code: 'TOKEN_EXPIRED', message: 'Access token expired.' });
    const uninstall = installInterceptors(instance, makeStore({ http: instance }));
    teardowns.push(() => {
      uninstall();
      mock.restore();
    });

    const error = await instance.get('/vault').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
    expect((error as ApiError).code).toBe('TOKEN_EXPIRED');
    expect(mock.history.get.filter((c) => c.url === '/vault')).toHaveLength(2);
    expect(postsTo(mock, '/auth/refresh')).toBe(1);
  });
});

describe('cancellation', () => {
  it('aborts the in-flight request when the caller’s signal fires', async () => {
    // A 200ms round trip so there is a wide, unambiguous window during which
    // the request is genuinely at the backend rather than still in an
    // interceptor — an abort during the latter is caught by axios before the
    // adapter runs, which proves nothing about the transport.
    const { instance, mock } = makeStack(200);

    // Warm the session first, so the abort lands on the claims request rather
    // than on the login that would otherwise precede it.
    const policies = await instance.get<Policy[]>('/policies');
    const policyId = policies.data[0].id;

    const controller = new AbortController();
    const pending = instance.get<Claim[]>(`/policies/${policyId}/claims`, {
      signal: controller.signal,
    });
    await new Promise((resolve) => setTimeout(resolve, 25));
    controller.abort();

    const error = await pending.catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).canceled).toBe(true);
    expect((error as ApiError).code).toBe('ERR_CANCELED');
    expect((error as ApiError).status).toBe(0);
    // The abort still identifies which request it abandoned — see the note on
    // `delay` in mockBackend.ts for what an unattributed cancel costs.
    expect((error as ApiError).correlationId).toMatch(/^req-\d{4}$/);

    // The request really was dispatched — this is a transport-level abort,
    // not a caller that never sent anything.
    expect(mock.history.get.filter((c) => c.url === `/policies/${policyId}/claims`)).toHaveLength(1);
  });
});
