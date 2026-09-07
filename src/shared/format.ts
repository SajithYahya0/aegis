import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import type { ClaimStatus, PolicyStatus, PolicyType } from './types';

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const compactCurrency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const decimal = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

const percent = new Intl.NumberFormat('en-IN', {
  style: 'percent',
  maximumFractionDigits: 1,
});

/** `₹18,442` — the canonical premium/sum-insured rendering. */
export function formatCurrency(value: number): string {
  return currency.format(value);
}

/** `₹1.8L` — for dense cells where the full figure would wrap. */
export function formatCompactCurrency(value: number): string {
  return compactCurrency.format(value);
}

export function formatNumber(value: number): string {
  return decimal.format(value);
}

/** Takes a fraction, not a percentage: `0.38` → `38%`. */
export function formatPercent(fraction: number): string {
  return percent.format(fraction);
}

/** `24 Aug 2026`. */
export function formatDate(iso: string): string {
  return format(parseISO(iso), 'dd MMM yyyy');
}

/**
 * Whole days from today until `iso`. Negative once the date has passed.
 * Calendar days, not elapsed 24-hour periods — otherwise a policy expiring
 * tonight reads as "0 days" for most of today and the renewal banner never
 * fires.
 */
export function daysUntil(iso: string, from: Date = new Date()): number {
  return differenceInCalendarDays(parseISO(iso), from);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* -------------------------------------------------------------------------- */
/* Enum → label                                                               */
/* -------------------------------------------------------------------------- */

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

export const CLAIM_STATUS_LABEL: Record<ClaimStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  underReview: 'Under review',
  approved: 'Approved',
  rejected: 'Rejected',
};
