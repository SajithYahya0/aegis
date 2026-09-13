import axios, { type AxiosInstance } from 'axios';
import type { Claim, ClaimType, Policy, PolicyDetail, PolicyStatus, PolicyType } from '../domain';

export const http: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 8000,
  headers: { Accept: 'application/json' },
});

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface PolicyQuery {
  q: string;
  status: PolicyStatus | '';
  type: PolicyType | '';
  expiring: boolean;
}

export interface UnderwritingLimits {
  autoBindLimit: number;
  maxLoadingPct: number;
  referralLossRatio: number;
}

export type DecisionOutcome = 'accept' | 'refer' | 'decline';

export interface DecisionDraft {
  policyId: string;
  outcome: DecisionOutcome;
  loadingPct: number;
  note: string;
}

export interface Decision extends DecisionDraft {
  id: string;
  decidedAt: string;
}

export interface ClaimDraft {
  policyId: string;
  type: ClaimType;
  amount: number;
  incidentDate: string;
  claimantPhone: string;
  description: string;
}

export interface QuoteRequest {
  id: string;
  name: string;
  phone: string;
  city: string;
  policyType: PolicyType;
  sumInsured: number;
  indicativePremium: number;
  receivedAt: string;
}

export async function fetchQuoteRequests(signal?: AbortSignal): Promise<QuoteRequest[]> {
  const response = await fetch('/site-api/quote-requests', { signal });
  if (!response.ok) throw new ApiError('The public site could not be reached.');
  return (await response.json()) as QuoteRequest[];
}

export async function fetchPolicies(query: PolicyQuery, signal?: AbortSignal): Promise<Policy[]> {
  const params: Record<string, string> = {};
  if (query.q) params.q = query.q;
  if (query.status) params.status = query.status;
  if (query.type) params.type = query.type;
  if (query.expiring) params.expiring = '1';
  const response = await http.get<Policy[]>('/policies', { params, signal });
  return response.data;
}

export async function fetchPolicyDetail(id: string, signal?: AbortSignal): Promise<PolicyDetail> {
  const response = await http.get<PolicyDetail>(`/policies/${encodeURIComponent(id)}`, { signal });
  return response.data;
}

export async function fetchClaims(signal?: AbortSignal): Promise<Claim[]> {
  const response = await http.get<Claim[]>('/claims', { signal });
  return response.data;
}

export async function submitClaim(draft: ClaimDraft): Promise<Claim> {
  const response = await http.post<Claim>(
    `/policies/${encodeURIComponent(draft.policyId)}/claims`,
    draft,
  );
  return response.data;
}

export async function fetchUnderwritingLimits(signal?: AbortSignal): Promise<UnderwritingLimits> {
  const response = await http.get<UnderwritingLimits>('/underwriting/limits', { signal });
  return response.data;
}

export async function submitDecision(draft: DecisionDraft): Promise<Decision> {
  const response = await http.post<Decision>('/underwriting/decisions', draft);
  return response.data;
}
