import { describe, expect, it } from 'vitest';
import { fetchPolicies, http } from './client';
import { installInterceptors } from './interceptors';
import { installMockBackend } from './mockBackend';
import { store } from '../store';
import { loginThunk } from '../store/authSlice';

installMockBackend(http);
installInterceptors(store);

const NO_FILTERS = { q: '', status: '', type: '', expiring: false } as const;
const EXPIRED_ACCESS_TOKEN = 'at-99-agent-0';
const MAX_REFRESHES_PER_SESSION = 3;

function expireAccessToken(): void {
  store.dispatch({
    type: loginThunk.fulfilled.type,
    payload: {
      accessToken: EXPIRED_ACCESS_TOKEN,
      refreshToken: store.getState().auth.refreshToken,
    },
  });
}

describe('axios interceptors', () => {
  it('signs in on the first request and sends a bearer token', async () => {
    const policies = await fetchPolicies(NO_FILTERS);

    expect(policies.length).toBeGreaterThan(0);
    expect(store.getState().auth.token).toMatch(/^at-/);
  });

  it('refreshes an expired access token and replays the original request', async () => {
    await store.dispatch(loginThunk()).unwrap();
    expireAccessToken();
    expect(store.getState().auth.token).toBe(EXPIRED_ACCESS_TOKEN);

    const policies = await fetchPolicies(NO_FILTERS);

    expect(policies.length).toBeGreaterThan(0);
    expect(store.getState().auth.token).not.toBe(EXPIRED_ACCESS_TOKEN);
  });

  it('surfaces a failed request as a dismissable error with a correlation id', async () => {
    await expect(http.get('/policies/POL-DOES-NOT-EXIST')).rejects.toThrow(/not in the book/);

    const { message, correlationId } = store.getState().httpError;
    expect(message).toMatch(/not in the book/);
    expect(correlationId).toMatch(/^req-\d{4}$/);
  });

  it('signs the user out once the refresh token has rotated for the last time', async () => {
    await store.dispatch(loginThunk()).unwrap();

    for (let rotation = 0; rotation < MAX_REFRESHES_PER_SESSION; rotation += 1) {
      expireAccessToken();
      await fetchPolicies(NO_FILTERS);
    }

    expireAccessToken();
    await expect(fetchPolicies(NO_FILTERS)).rejects.toThrow(/session has ended/);

    expect(store.getState().auth.token).toBeNull();
    expect(store.getState().auth.status).toBe('idle');
  }, 20_000);
});
