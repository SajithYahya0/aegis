/**
 * WHY THIS EXISTS:
 *   Builds the whole demo book — customers, policies, claims and documents —
 *   from one integer seed, with referential integrity (every `claim.policyId`
 *   resolves, every `policy.claimIds` entry exists, every `policy.customerId`
 *   resolves).
 *
 * CONCEPTS: W1-08, W3-D1-03, C-03
 *
 * WITHOUT THIS:
 *   Two separate failures. (1) Volume: with a hand-written 6-policy fixture,
 *   `rateBook` over the book finishes in well under a millisecond, so wrapping
 *   it in `useMemo` (W3-D1-03) changes nothing measurable and the reviewer is
 *   right to ask why it is there. `useDeferredValue` (C-03) has the same
 *   problem — a 6-row list re-renders faster than a keystroke, so there is no
 *   lag to defer and the dimmed-while-stale UI never appears. (2) Integrity:
 *   generating claims independently of policies produces `claim.policyId`
 *   values that resolve to `undefined`, and the claims tab on /policies/:id
 *   crashes on `policy.coverages.find(...)` rather than rendering an empty
 *   state.
 *
 *   Dates are drawn as *offsets from today*, not as absolute calendar dates.
 *   Absolute dates would mean "expires within 30 days" matches a different set
 *   of policies every week and the renewal countdown eventually counts down
 *   past zero for the entire book, so the expiring-soon filter and the
 *   countdown timer would both be dead on any day but the day this was written.
 */

import type {
  Claim,
  ClaimStatus,
  ClaimType,
  Coverage,
  Customer,
  Policy,
  PolicyDocument,
  PolicyType,
} from '../types';
import {
  CATALOGUE,
  CLAIM_NARRATIVES,
  FIRST_NAMES,
  LAST_NAMES,
  PLACES,
  type CatalogueEntry,
} from './catalogue';
import { chance, createRng, float, int, pick, shuffled, weighted, type Rng } from './rng';

export const SEED = 0x41454749; // "AEGI"

export const CUSTOMER_COUNT = 40;
export const TARGET_CLAIM_COUNT = 60;

export interface SeedBook {
  /** The valuation date every offset was measured from. */
  asOf: string;
  customers: Customer[];
  policies: Policy[];
  claims: Claim[];
  documents: PolicyDocument[];
}

/* -------------------------------------------------------------------------- */
/* Date helpers — everything is a day offset from the valuation date           */
/* -------------------------------------------------------------------------- */

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function isoFromOffset(anchor: Date, dayOffset: number): string {
  const d = new Date(anchor.getTime() + dayOffset * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/* -------------------------------------------------------------------------- */
/* Sampling                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Standard normal via Box-Muller, driven by the seeded rng so claim amounts
 * are heavy-tailed rather than uniform. A uniform amount would give the
 * claims-history loading nothing to discriminate on: every claimant would look
 * equally bad and the loading column would be a constant.
 */
function standardNormal(rng: Rng): number {
  const u1 = Math.max(rng(), Number.EPSILON);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function lognormal(rng: Rng, mean: number, cv: number): number {
  const sigma = Math.sqrt(Math.log(1 + cv * cv));
  const mu = Math.log(mean) - (sigma * sigma) / 2;
  return Math.exp(mu + sigma * standardNormal(rng));
}

function roundTo(value: number, step: number): number {
  return Math.max(step, Math.round(value / step) * step);
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

/* -------------------------------------------------------------------------- */
/* Per-product parameters                                                     */
/* -------------------------------------------------------------------------- */

const SUM_INSURED_BANDS: Record<PolicyType, { min: number; max: number; step: number }> = {
  motor: { min: 300_000, max: 2_500_000, step: 25_000 },
  health: { min: 300_000, max: 5_000_000, step: 50_000 },
  property: { min: 1_500_000, max: 25_000_000, step: 100_000 },
  life: { min: 2_500_000, max: 30_000_000, step: 250_000 },
};

const TERM_MONTHS: Record<PolicyType, readonly number[]> = {
  motor: [12],
  health: [12, 12, 24],
  property: [12, 24, 36],
  life: [120, 180, 240, 300],
};

const TYPE_MIX = [
  ['motor', 0.34],
  ['health', 0.3],
  ['property', 0.22],
  ['life', 0.14],
] as const satisfies readonly (readonly [PolicyType, number])[];

const STATUS_MIX = [
  ['active', 0.62],
  ['lapsed', 0.14],
  ['pending', 0.12],
  ['cancelled', 0.12],
] as const;

/** How many claims a policy that claims at all files. Mean ≈ 1.5. */
const CLAIMS_PER_CLAIMANT = [
  [1, 0.58],
  [2, 0.3],
  [3, 0.12],
] as const;

const CLAIM_STATUS_MIX = [
  ['approved', 0.38],
  ['underReview', 0.22],
  ['submitted', 0.18],
  ['rejected', 0.14],
  ['draft', 0.08],
] as const satisfies readonly (readonly [ClaimStatus, number])[];

/* -------------------------------------------------------------------------- */
/* Builders                                                                   */
/* -------------------------------------------------------------------------- */

function buildCustomers(rng: Rng, anchor: Date): Customer[] {
  const customers: Customer[] = [];
  for (let i = 0; i < CUSTOMER_COUNT; i++) {
    const first = pick(rng, FIRST_NAMES);
    const last = pick(rng, LAST_NAMES);
    const place = pick(rng, PLACES);
    const ageYears = int(rng, 21, 72);
    const tenureYears = int(rng, 1, 14);

    customers.push({
      id: `CUS-${pad(i + 1, 4)}`,
      name: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${i + 1}@example.in`,
      phone: `+91 ${int(rng, 70, 99)}${pad(int(rng, 0, 99_999_999), 8)}`,
      city: place.city,
      state: place.state,
      dateOfBirth: isoFromOffset(anchor, -(ageYears * 365 + int(rng, 0, 364))),
      customerSince: isoFromOffset(anchor, -(tenureYears * 365 + int(rng, 0, 364))),
    });
  }
  return customers;
}

function buildCoverages(rng: Rng, policyId: string, type: PolicyType, sumInsured: number): Coverage[] {
  const entries = CATALOGUE[type];
  const chosen: CatalogueEntry[] = entries.filter(
    (entry) => entry.mandatory || chance(rng, 0.45),
  );

  return chosen.map((entry, index) => {
    const limit = roundTo(sumInsured * entry.limitFraction, 5_000);
    return {
      id: `${policyId}-CVG-${pad(index + 1, 2)}`,
      code: entry.code,
      label: entry.label,
      limit,
      deductible: roundTo(limit * entry.deductibleFraction, 500),
      mandatory: entry.mandatory,
    };
  });
}

/**
 * Returns the day offset (relative to the valuation date) on which the policy
 * expires. The distribution is deliberately shaped so that roughly one policy
 * in eight of the in-force book is inside the 30-day renewal window — enough
 * rows for the expiring-soon filter to visibly narrow the table, few enough
 * that it is visibly a filter and not a no-op.
 */
function drawExpiryOffset(rng: Rng, status: string, termMonths: number): number {
  const termDays = termMonths * 30;
  switch (status) {
    case 'active':
      return chance(rng, 0.13) ? int(rng, 1, 30) : int(rng, 31, Math.max(60, termDays));
    case 'pending':
      return termDays + int(rng, 1, 45);
    default: // lapsed | cancelled — already off risk
      return -int(rng, 1, 400);
  }
}

function buildPolicies(rng: Rng, anchor: Date, customers: Customer[]): Policy[] {
  const policies: Policy[] = [];
  let counter = 0;

  for (const customer of customers) {
    const howMany = int(rng, 2, 5);
    for (let i = 0; i < howMany; i++) {
      counter += 1;
      const id = `POL-${pad(counter, 5)}`;
      const type = weighted(rng, TYPE_MIX);
      const status = weighted(rng, STATUS_MIX);
      const band = SUM_INSURED_BANDS[type];
      const sumInsured = roundTo(float(rng, band.min, band.max), band.step);
      const termMonths = pick(rng, TERM_MONTHS[type]);

      const expiryOffset = drawExpiryOffset(rng, status, termMonths);
      const startOffset = expiryOffset - termMonths * 30;

      policies.push({
        id,
        customerId: customer.id,
        type,
        status,
        sumInsured,
        startDate: isoFromOffset(anchor, startOffset),
        endDate: isoFromOffset(anchor, expiryOffset),
        coverages: buildCoverages(rng, id, type, sumInsured),
        claimIds: [],
      });
    }
  }

  return policies;
}

/**
 * Claims are attached to policies that were actually on risk, and are dated
 * inside the policy period and in the past. A claim filed before inception or
 * after expiry would make the claims-history loading (which counts claims in
 * the last three policy years) produce a negative exposure and therefore a
 * negative loading, which surfaces as a *discount* for having claimed.
 */
function buildClaims(rng: Rng, anchor: Date, policies: Policy[]): Claim[] {
  const eligible = policies.filter((p) => {
    const started = new Date(`${p.startDate}T00:00:00Z`).getTime();
    return p.status !== 'pending' && started < anchor.getTime();
  });

  const claims: Claim[] = [];
  const order = shuffled(rng, eligible);
  let counter = 0;

  // Walk the shuffled pool once, and give each policy that claims at all a
  // *drawn number* of claims rather than exactly one.
  //
  // The alternative — one claim per policy until the target is met — puts all
  // 60 claims on 60 distinct policies, so no policy in the book has a claims
  // history. The `0.22 * count` term of the claims-history loading would then
  // be dead code for the entire demo, the no-claim-bonus ladder would never
  // step below its top rung, and the underwriting queue would have no repeat
  // claimant to sort to the top.
  for (const policy of order) {
    if (claims.length >= TARGET_CLAIM_COUNT) break;

    const howMany = weighted(rng, CLAIMS_PER_CLAIMANT);
    for (let n = 0; n < howMany && claims.length < TARGET_CLAIM_COUNT; n++) {
      const coverage = pick(rng, policy.coverages);
      const entry = CATALOGUE[policy.type].find((c) => c.code === coverage.code);
      if (!entry) continue;

      const claimType: ClaimType = pick(rng, entry.claimTypes);
      const raw = lognormal(
        rng,
        Math.max(entry.severityMeanFraction * coverage.limit, 10_000),
        entry.severityCv,
      );
      const amount = roundTo(Math.min(raw, coverage.limit), 500);

      const startMs = new Date(`${policy.startDate}T00:00:00Z`).getTime();
      const endMs = new Date(`${policy.endDate}T00:00:00Z`).getTime();
      const windowEnd = Math.min(endMs, anchor.getTime());
      const spanDays = Math.max(1, Math.floor((windowEnd - startMs) / 86_400_000));
      const filedOffset =
        Math.floor((startMs - anchor.getTime()) / 86_400_000) + int(rng, 1, spanDays);

      counter += 1;
      const claim: Claim = {
        id: `CLM-${pad(counter, 5)}`,
        policyId: policy.id,
        type: claimType,
        amount,
        status: weighted(rng, CLAIM_STATUS_MIX),
        filedAt: isoFromOffset(anchor, filedOffset),
        description: pick(rng, CLAIM_NARRATIVES[claimType]),
      };
      claims.push(claim);
      policy.claimIds.push(claim.id);
    }
  }

  return claims;
}

function buildDocuments(rng: Rng, anchor: Date, policies: Policy[]): PolicyDocument[] {
  const documents: PolicyDocument[] = [];
  let counter = 0;

  const add = (
    policy: Policy,
    name: string,
    kind: PolicyDocument['kind'],
    maxAgeDays: number,
  ): void => {
    counter += 1;
    documents.push({
      id: `DOC-${pad(counter, 5)}`,
      policyId: policy.id,
      name,
      kind,
      sizeBytes: int(rng, 48_000, 4_200_000),
      uploadedAt: isoFromOffset(anchor, -int(rng, 1, maxAgeDays)),
    });
  };

  for (const policy of policies) {
    add(policy, `${policy.id} — Policy schedule.pdf`, 'schedule', 720);
    add(policy, `${policy.id} — KYC pack.pdf`, 'kyc', 900);
    if (chance(rng, 0.55)) add(policy, `${policy.id} — Premium invoice.pdf`, 'invoice', 400);
    if (chance(rng, 0.3)) add(policy, `${policy.id} — Endorsement 01.pdf`, 'endorsement', 300);
    for (const claimId of policy.claimIds) {
      add(policy, `${claimId} — Claim form.pdf`, 'claimForm', 500);
    }
  }

  return documents;
}

/**
 * Deterministic given `seed`. The valuation date defaults to today (UTC,
 * truncated to the day) so that renewal windows stay meaningful; pass an
 * explicit `asOf` from a test that needs a frozen calendar.
 */
export function buildBook(seed: number = SEED, asOf: Date = new Date()): SeedBook {
  const anchor = startOfUtcDay(asOf);
  const rng = createRng(seed);

  const customers = buildCustomers(rng, anchor);
  const policies = buildPolicies(rng, anchor, customers);
  const claims = buildClaims(rng, anchor, policies);
  const documents = buildDocuments(rng, anchor, policies);

  return {
    asOf: anchor.toISOString().slice(0, 10),
    customers,
    policies,
    claims,
    documents,
  };
}
