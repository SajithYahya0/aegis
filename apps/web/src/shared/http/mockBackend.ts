import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { UNDERWRITING_LIMITS, claims as seedClaims, policies } from '../data';
import { daysUntil } from '../domain';
import type { Claim, Policy } from '../domain';
import { body, delay, installSession, type Reply } from './mockSession';

const EXPIRING_WINDOW_DAYS = 30;
const MIN_SERVER_NOTE_CHARS = 10;

const POLICY_URL = /^\/policies\/([^/]+)$/;
const POLICY_CLAIMS_URL = /^\/policies\/([^/]+)\/claims$/;

function idFrom(config: AxiosRequestConfig, pattern: RegExp): string {
  return pattern.exec(config.url ?? '')?.[1] ?? '';
}

function policyById(id: string): Policy | undefined {
  return policies.find((candidate) => candidate.id === id);
}

export function installMockBackend(instance: AxiosInstance): MockAdapter {
  const mock = new MockAdapter(instance);
  const guardAccess = installSession(mock);
  const filedClaims: Claim[] = [];

  async function serve(config: AxiosRequestConfig, produce: () => Reply): Promise<Reply> {
    const denied = guardAccess(config);
    if (denied) return denied;
    await delay(config);
    return produce();
  }

  const allClaims = (): Claim[] => [...filedClaims, ...seedClaims];

  mock.onGet('/policies').reply((config) =>
    serve(config, () => {
      const params = (config.params ?? {}) as Record<string, string>;
      const needle = (params.q ?? '').trim().toLowerCase();
      const matches = policies.filter((policy) => {
        if (params.status && policy.status !== params.status) return false;
        if (params.type && policy.type !== params.type) return false;
        if (params.expiring === '1') {
          const days = daysUntil(policy.endDate);
          if (days < 0 || days > EXPIRING_WINDOW_DAYS) return false;
        }
        return !needle || `${policy.id} ${policy.customerName}`.toLowerCase().includes(needle);
      });
      return [200, matches];
    }),
  );

  mock.onGet(POLICY_URL).reply((config) =>
    serve(config, () => {
      const id = idFrom(config, POLICY_URL);
      const policy = policyById(id);
      if (!policy) return [404, { message: `Policy ${id} is not in the book.` }];
      return [200, { policy, claims: allClaims().filter((claim) => claim.policyId === id) }];
    }),
  );

  mock.onPost(POLICY_CLAIMS_URL).reply((config) =>
    serve(config, () => {
      const id = idFrom(config, POLICY_CLAIMS_URL);
      const policy = policyById(id);
      if (!policy) return [404, { message: `Policy ${id} is not in the book.` }];
      const draft = body(config);
      const amount = Number(draft.amount ?? 0);
      if (amount > policy.sumInsured) {
        return [422, { message: `A claim cannot exceed the sum insured on ${policy.id}.` }];
      }
      const claim: Claim = {
        id: `CLM-${5100 + filedClaims.length}`,
        policyId: id,
        type: draft.type as Claim['type'],
        amount,
        status: 'submitted',
        filedAt: new Date().toISOString().slice(0, 10),
        description: String(draft.description ?? ''),
      };
      filedClaims.unshift(claim);
      return [201, claim];
    }),
  );

  mock.onGet('/claims').reply((config) => serve(config, () => [200, allClaims()]));

  mock.onGet('/underwriting/limits').reply((config) =>
    serve(config, () => [200, UNDERWRITING_LIMITS]),
  );

  mock.onPost('/underwriting/decisions').reply((config) =>
    serve(config, () => {
      const draft = body(config);
      if (String(draft.note ?? '').trim().length < MIN_SERVER_NOTE_CHARS) {
        return [422, { message: 'The underwriting note is too short to record.' }];
      }
      const id = `UWD-${Date.now().toString().slice(-6)}`;
      return [201, { ...draft, id, decidedAt: new Date().toISOString() }];
    }),
  );

  return mock;
}
