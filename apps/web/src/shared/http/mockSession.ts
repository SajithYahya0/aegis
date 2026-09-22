import axios, { type AxiosRequestConfig } from 'axios';
import type MockAdapter from 'axios-mock-adapter';
import type { User } from '../domain';

const ACCESS_TOKEN_TTL_MS = 60_000;
const MAX_REFRESHES_PER_SESSION = 3;
const MIN_LATENCY_MS = 180;
const MAX_LATENCY_MS = 420;

export type Reply = [number, unknown];

interface Account {
  password: string;
  user: User;
}

const ACCOUNTS = new Map<string, Account>([
  ['parmes', { password: 'agent123', user: { id: 'usr-agent-01', name: 'Parmes', role: 'agent', branch: 'Chennai' } }],
  ['arvind', { password: 'underwriter123', user: { id: 'usr-uw-01', name: 'Arvind Rao', role: 'underwriter', branch: 'Mumbai' } }],
]);

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export function delay(config: AxiosRequestConfig): Promise<void> {
  const signal = config.signal as AbortSignal | undefined;
  const ms = MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS);
  return new Promise((resolve, reject) => {
    const cancel = (): void => reject(new axios.CanceledError());
    if (signal?.aborted) return cancel();
    const timer = setTimeout(resolve, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      cancel();
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function body(config: AxiosRequestConfig): Record<string, unknown> {
  try {
    return typeof config.data === 'string' ? JSON.parse(config.data) : {};
  } catch {
    return {};
  }
}

function bearer(config: AxiosRequestConfig): string {
  const header = config.headers?.Authorization ?? config.headers?.authorization;
  return String(header ?? '').replace(/^Bearer\s+/i, '');
}

export function installSession(mock: MockAdapter): (config: AxiosRequestConfig) => Reply | null {
  const refreshGeneration = new Map<string, number>();
  let issued = 0;

  function issueTokens(role: string, generation: number): TokenPair {
    issued += 1;
    const pair = {
      accessToken: `at-${issued}-${role}-${Date.now()}`,
      refreshToken: `rt-${issued}-${role}`,
    };
    refreshGeneration.set(pair.refreshToken, generation);
    return pair;
  }

  mock.onPost('/auth/login').reply(async (config) => {
    await delay(config);
    const { username, password } = body(config);
    const account = ACCOUNTS.get(String(username ?? '').trim().toLowerCase());
    if (!account || account.password !== password) {
      return [401, { message: 'Incorrect username or password.' }];
    }
    return [200, { ...issueTokens(account.user.role, 0), user: account.user }];
  });

  mock.onPost('/auth/refresh').reply(async (config) => {
    await delay(config);
    const presented = String(body(config).refreshToken ?? '');
    const generation = refreshGeneration.get(presented);
    refreshGeneration.delete(presented);
    if (generation === undefined || generation >= MAX_REFRESHES_PER_SESSION) {
      return [401, { message: 'Your session has ended. Sign in again.' }];
    }
    return [200, issueTokens('refreshed', generation + 1)];
  });

  return (config) => {
    const token = bearer(config);
    if (!token) return [401, { message: 'Missing bearer token.' }];
    const issuedAt = Number(token.split('-').pop() ?? 0);
    if (Date.now() - issuedAt > ACCESS_TOKEN_TTL_MS) {
      return [401, { message: 'Access token expired.' }];
    }
    return null;
  };
}
