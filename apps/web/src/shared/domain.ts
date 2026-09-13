import { differenceInCalendarDays, format, parseISO } from 'date-fns';

export type Role = 'agent' | 'underwriter';

export type PolicyType = 'motor' | 'health' | 'property' | 'life';

export type PolicyStatus = 'active' | 'lapsed' | 'pending' | 'cancelled';

export type ClaimType =
  | 'accident' | 'theft' | 'fire' | 'flood'
  | 'hospitalisation' | 'liability' | 'other';

export type ClaimStatus = 'submitted' | 'underReview' | 'approved' | 'rejected';

export interface User {
  id: string;
  name: string;
  role: Role;
  branch: string;
}

export interface Coverage {
  code: string;
  label: string;
  limit: number;
  deductible: number;
  mandatory: boolean;
}

export interface Policy {
  id: string;
  customerName: string;
  city: string;
  type: PolicyType;
  status: PolicyStatus;
  sumInsured: number;
  annualPremium: number;
  startDate: string;
  endDate: string;
  coverages: Coverage[];
}

export interface Claim {
  id: string;
  policyId: string;
  type: ClaimType;
  amount: number;
  status: ClaimStatus;
  filedAt: string;
  description: string;
}

export interface PolicyDetail {
  policy: Policy;
  claims: Claim[];
}

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const compact = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const percent = new Intl.NumberFormat('en-IN', { style: 'percent', maximumFractionDigits: 1 });

export function formatCurrency(value: number): string {
  return currency.format(value);
}

export function formatCompactCurrency(value: number): string {
  return compact.format(value);
}

export function formatPercent(fraction: number): string {
  return percent.format(fraction);
}

export function formatDate(iso: string): string {
  return format(parseISO(iso), 'dd MMM yyyy');
}

export function daysUntil(iso: string): number {
  return differenceInCalendarDays(parseISO(iso), new Date());
}

export const POLICY_TYPE_LABEL: Record<PolicyType, string> = {
  motor: 'Motor',
  health: 'Health',
  property: 'Property',
  life: 'Life',
};

export const POLICY_STATUS_LABEL: Record<PolicyStatus, string> = {
  active: 'Active',
  lapsed: 'Lapsed',
  pending: 'Pending',
  cancelled: 'Cancelled',
};

export const CLAIM_TYPE_LABEL: Record<ClaimType, string> = {
  accident: 'Accident',
  theft: 'Theft',
  fire: 'Fire',
  flood: 'Flood',
  hospitalisation: 'Hospitalisation',
  liability: 'Liability',
  other: 'Other',
};

export const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  submitted: 'Submitted',
  underReview: 'Under review',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const POLICY_TYPES = ['motor', 'health', 'property', 'life'] as const;

export const POLICY_STATUSES = ['active', 'pending', 'lapsed', 'cancelled'] as const;

export const CLAIM_TYPES = [
  'accident', 'theft', 'fire', 'flood', 'hospitalisation', 'liability', 'other',
] as const;

export type StatusColor = 'success' | 'warning' | 'error' | 'default' | 'info';

export const POLICY_STATUS_COLOR: Record<PolicyStatus, StatusColor> = {
  active: 'success',
  pending: 'warning',
  lapsed: 'error',
  cancelled: 'default',
};

export const CLAIM_STATUS_COLOR: Record<ClaimStatus, StatusColor> = {
  submitted: 'info',
  underReview: 'warning',
  approved: 'success',
  rejected: 'error',
};
