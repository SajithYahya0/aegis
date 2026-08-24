/**
 * WHY THIS EXISTS:
 *   Prices a policy. Not a lookup table: it builds a discretised severity
 *   distribution per coverage line, compounds it against a Poisson claim count
 *   to get that line's aggregate loss distribution, convolves the lines
 *   together to get the policy's aggregate, and charges expected loss plus a
 *   risk margin driven by the 95% tail. Then it applies the manual-rate
 *   credibility blend, the age and claims loadings, and the no-claim,
 *   sum-insured-band and tenure discounts.
 *
 * CONCEPTS: W3-D1-03, C-03, C-02
 *
 * WITHOUT THIS:
 *   `useMemo` around `rateBook` (W3-D1-03) is the one row in the matrix that
 *   cannot be demonstrated with cheap code. If the premium were
 *   `sumInsured * 0.02`, memoising it would save nothing measurable, the
 *   reviewer would correctly say "that useMemo is cargo cult", and W3-D1-06
 *   ("when NOT to optimise") would have no counterpart to contrast against.
 *   Removing the `useMemo` on a real `rateBook` call makes every keystroke in
 *   the /policies search box re-price 130+ policies on the main thread, and
 *   the input visibly drops characters — which is also what makes
 *   `useDeferredValue` (C-03) worth having.
 *
 *   The tail matters and is the reason this is expensive rather than merely
 *   arithmetic-heavy: a risk margin is a *percentile* of the aggregate loss,
 *   and percentiles do not compose from means. E[L] for six coverage lines is
 *   just the sum of six numbers, but the 95th percentile of their total
 *   requires the actual convolved distribution. That convolution is the cost,
 *   and it is real work, not a busy-wait.
 */

import { differenceInCalendarDays, parseISO } from 'date-fns';
import { BASE_RATE_PER_MILLE, CATALOGUE_BY_CODE } from './data/catalogue';
import type { Claim, Coverage, Customer, Policy, PolicyType } from './types';

/* -------------------------------------------------------------------------- */
/* Model parameters                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Buckets in the discretised loss grid. Higher is more accurate and quadratically
 * more expensive (each convolution is O(BUCKETS²)). 48 puts a full re-rate of
 * the demo book in the tens of milliseconds — slow enough that dropping the
 * memo is visible, fast enough that the app is still usable.
 */
const BUCKETS = 48;

/** Claim counts modelled explicitly; residual Poisson mass folds into the top. */
const MAX_CLAIM_COUNT = 4;

/** Level at which the tail value-at-risk driving the risk margin is taken. */
const TVAR_LEVEL = 0.95;

/**
 * Share of (TVaR − expected loss) charged as a risk margin.
 *
 * Deliberately small. The TVaR computed here is a *single policy's* tail, and a
 * single policy's tail is enormous relative to its mean — one term-life policy
 * either pays nothing or pays the whole sum assured. An insurer does not charge
 * for that, because it holds thousands of them and the aggregate tail is a
 * fraction of the sum of the individual tails. Charging the standalone tail in
 * full priced term life at several percent of the sum assured per year; this
 * rate is the share that survives diversification.
 */
const RISK_MARGIN_RATE = 0.06;

/** Weight on the modelled premium vs. the manual (per-mille) rate. */
const CREDIBILITY = 0.72;

/** Commission, servicing and overhead, as a share of gross written premium. */
const EXPENSE_RATIO = 0.14;

/** Losses are paid mid-term on average; premium is collected up front. */
const DISCOUNT_RATE = 0.07;

const DAYS_PER_YEAR = 365.25;

export interface PremiumBreakdown {
  policyId: string;
  /** Mean of the policy's aggregate annual loss distribution. */
  expectedLoss: number;
  /** Mean of the worst 5% of that distribution. */
  tvar95: number;
  /** Discounted expected loss. */
  riskPremium: number;
  /** Charge for volatility above the mean. */
  riskMargin: number;
  /** Book rate: base per-mille rate × sum insured. */
  manualPremium: number;
  /** Credibility blend of (riskPremium + riskMargin) against manualPremium. */
  technicalPremium: number;
  loadings: { age: number; claims: number };
  discounts: { noClaimBonus: number; sumInsuredBand: number; tenure: number };
  /** Premium after loadings and discounts, before expenses. */
  netPremium: number;
  expenseLoading: number;
  /** What the customer pays per year, rounded to the nearest ₹10. */
  annualPremium: number;
}

/* -------------------------------------------------------------------------- */
/* Distribution machinery                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Probability mass over `BUCKETS` equal-width loss buckets. `Float64Array`
 * rather than `number[]`: the convolution is the hot loop and a packed
 * double array avoids the boxing and bounds-check overhead of a JS array,
 * which at ~7M inner iterations per book is the difference between the memo
 * demo being about the rating engine and it being about array access.
 *
 * Written unparameterised on purpose. TypeScript 5.7 made the typed arrays
 * generic in their backing buffer, so an annotated `let` must accept both the
 * `ArrayBuffer` a constructor returns and the `ArrayBufferLike` a function
 * signature yields; the alias keeps that detail in one place.
 */
type LossGrid = Float64Array;

/**
 * Bucket `i` on a grid of width `w` means a loss of exactly `i * w` — a
 * lattice of lower edges, not midpoints. Mass is placed on the nearest lattice
 * point, so the discretisation is unbiased in the mean.
 *
 * Two things break the moment bucket `i` is read as the midpoint `(i + 0.5)w`
 * instead. First, bucket 0 stops meaning "no loss" and starts meaning "half a
 * bucket of loss" — and since most policies have a ~99% chance of no claim on
 * most lines, that phantom half-bucket is multiplied by ~1.0 probability on
 * every coverage. On a life policy whose grid width is a twelfth of the sum
 * assured, it added ~4% of the sum assured of pure fiction to every line, and
 * the book priced term life at 14% of the sum assured per year.
 *
 * Second, convolution stops being correct: adding two losses lands in bucket
 * `i + j`, and midpoints do not add — `(i + 0.5)w + (j + 0.5)w` is `(i + j + 1)w`,
 * not the `(i + j + 0.5)w` the result bucket would be read as. Every
 * convolution therefore inserted an extra half-bucket of drift, compounding
 * once per coverage line. Lattice points add exactly.
 */
function toLattice(value: number, width: number): number {
  return Math.min(BUCKETS - 1, Math.round(value / width));
}

/** P(N = n) for N ~ Poisson(lambda). */
function poissonPmf(n: number, lambda: number): number {
  let logFactorial = 0;
  for (let i = 2; i <= n; i++) logFactorial += Math.log(i);
  return Math.exp(-lambda + n * Math.log(Math.max(lambda, Number.MIN_VALUE)) - logFactorial);
}

/**
 * Discretised single-claim payout for one coverage line, on a grid of
 * `BUCKETS` buckets of width `width`.
 *
 * Ground-up loss is lognormal with the catalogue's mean and CV. The payout is
 * that loss less the deductible, floored at zero and capped at the line's
 * limit — which is why the deductible actually earns its keep in the pricing
 * rather than being decorative: it moves mass into bucket 0.
 */
function severityPmf(coverage: Coverage, meanFraction: number, cv: number, width: number): LossGrid {
  const pmf = new Float64Array(BUCKETS);
  const mean = Math.max(meanFraction * coverage.limit, 1);
  const sigma = Math.sqrt(Math.log(1 + cv * cv));
  const mu = Math.log(mean) - (sigma * sigma) / 2;

  // Stratified quantiles of the lognormal: equal-probability slices, evaluated
  // at each slice's midpoint. Equal weights, so no normalisation drift.
  const strata = BUCKETS;
  const weight = 1 / strata;
  for (let s = 0; s < strata; s++) {
    const q = (s + 0.5) / strata;
    const groundUp = Math.exp(mu + sigma * inverseStandardNormalCdf(q));
    const payout = Math.min(Math.max(groundUp - coverage.deductible, 0), coverage.limit);
    pmf[toLattice(payout, width)] += weight;
  }
  return pmf;
}

/**
 * Acklam's rational approximation to the inverse standard normal CDF.
 * Accurate to ~1.15e-9 across the interval, which is far better than the
 * discretisation error of a 48-bucket grid — so the grid, not this, is the
 * limiting factor.
 */
function inverseStandardNormalCdf(p: number): number {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  if (p > pHigh) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return (((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q /
    (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
}

/**
 * Distribution of the sum of two independent losses on the same grid.
 * Mass that lands beyond the last bucket piles into it, so total probability
 * is conserved — losing it would understate the tail, which is precisely the
 * quantity the risk margin is charged on.
 */
function convolve(a: LossGrid, b: LossGrid): LossGrid {
  const out = new Float64Array(BUCKETS);
  for (let i = 0; i < BUCKETS; i++) {
    const pa = a[i]!;
    if (pa < 1e-12) continue;
    for (let j = 0; j < BUCKETS; j++) {
      const pb = b[j]!;
      if (pb === 0) continue;
      const k = i + j;
      out[k < BUCKETS ? k : BUCKETS - 1] += pa * pb;
    }
  }
  return out;
}

/**
 * Compound distribution: total annual loss for one coverage line, mixing the
 * n-fold convolutions of the severity distribution against Poisson(lambda)
 * claim counts. Poisson mass above MAX_CLAIM_COUNT is folded onto the top
 * term rather than discarded.
 */
function compoundPmf(sevPmf: LossGrid, lambda: number): LossGrid {
  const agg = new Float64Array(BUCKETS);
  // n = 0: the whole mass sits at zero loss.
  agg[0] = poissonPmf(0, lambda);

  let nFold: LossGrid = new Float64Array(BUCKETS);
  nFold[0] = 1;
  let assigned = agg[0]!;

  for (let n = 1; n <= MAX_CLAIM_COUNT; n++) {
    nFold = convolve(nFold, sevPmf);
    const pn = n === MAX_CLAIM_COUNT ? Math.max(0, 1 - assigned) : poissonPmf(n, lambda);
    assigned += pn;
    if (pn < 1e-12) continue;
    for (let i = 0; i < BUCKETS; i++) agg[i] += pn * nFold[i]!;
  }
  return agg;
}

/** Re-express a distribution from one bucket width onto another. */
function rebin(pmf: LossGrid, fromWidth: number, toWidth: number): LossGrid {
  const out = new Float64Array(BUCKETS);
  for (let i = 0; i < BUCKETS; i++) {
    const mass = pmf[i]!;
    if (mass === 0) continue;
    out[toLattice(i * fromWidth, toWidth)] += mass;
  }
  return out;
}

function expectedValue(pmf: LossGrid, width: number): number {
  let sum = 0;
  for (let i = 0; i < BUCKETS; i++) sum += pmf[i]! * i * width;
  return sum;
}

/**
 * Mean of the worst `1 - level` of the distribution. Walks down from the top
 * bucket accumulating mass until the tail probability is reached, taking a
 * partial slice of the bucket that straddles the boundary.
 */
function tailValueAtRisk(pmf: LossGrid, width: number, level: number): number {
  const target = 1 - level;
  let mass = 0;
  let sum = 0;
  for (let i = BUCKETS - 1; i >= 0; i--) {
    const p = pmf[i]!;
    if (p === 0) continue;
    const take = Math.min(p, target - mass);
    sum += take * i * width;
    mass += take;
    if (mass >= target - 1e-12) break;
  }
  return mass > 0 ? sum / mass : 0;
}

/* -------------------------------------------------------------------------- */
/* Loadings and discounts                                                     */
/* -------------------------------------------------------------------------- */

function yearsBetween(fromIso: string, to: Date): number {
  return differenceInCalendarDays(to, parseISO(fromIso)) / DAYS_PER_YEAR;
}

/**
 * Age loading by product. Property returns zero on purpose: the building is
 * the risk, not the owner, and loading a warehouse fire policy for the
 * proprietor's date of birth would be indefensible.
 */
function ageLoading(type: PolicyType, age: number): number {
  switch (type) {
    case 'motor':
      if (age < 25) return 0.38;
      if (age < 30) return 0.16;
      if (age < 60) return 0;
      if (age < 70) return 0.14;
      return 0.3;
    case 'health':
      return Math.pow(Math.max(age - 30, 0) / 30, 1.9) * 1.4;
    case 'life':
      return Math.pow(Math.max(age - 25, 0) / 30, 2.2) * 1.9;
    case 'property':
      return 0;
  }
}

/**
 * Claims-history loading over the trailing three years.
 *
 * `draft` and `rejected` claims are excluded. A rejected claim is one the
 * insurer decided it did not owe; loading the renewal for it would charge the
 * customer for the insurer's own declinature, and a drafted claim was never
 * even filed.
 */
function claimsLoading(policy: Policy, policyClaims: readonly Claim[], asOf: Date): number {
  let count = 0;
  let total = 0;
  for (const claim of policyClaims) {
    if (claim.status === 'draft' || claim.status === 'rejected') continue;
    if (yearsBetween(claim.filedAt, asOf) > 3) continue;
    count += 1;
    total += claim.amount;
  }
  if (count === 0) return 0;
  const severityRatio = Math.min(total / Math.max(policy.sumInsured, 1), 1);
  return Math.min(1.5, 0.22 * count + 0.9 * severityRatio);
}

const NCB_STEPS = [0, 0.2, 0.25, 0.35, 0.45, 0.5] as const;

function noClaimBonus(policy: Policy, policyClaims: readonly Claim[], asOf: Date): number {
  let claimFreeSince = yearsBetween(policy.startDate, asOf);
  for (const claim of policyClaims) {
    if (claim.status === 'draft' || claim.status === 'rejected') continue;
    claimFreeSince = Math.min(claimFreeSince, yearsBetween(claim.filedAt, asOf));
  }
  const whole = Math.max(0, Math.floor(claimFreeSince));
  return NCB_STEPS[Math.min(whole, NCB_STEPS.length - 1)]!;
}

/** Volume discount: large sums insured cost proportionally less to service. */
function sumInsuredBandDiscount(sumInsured: number): number {
  if (sumInsured < 1_000_000) return 0;
  if (sumInsured < 5_000_000) return 0.03;
  if (sumInsured < 10_000_000) return 0.055;
  if (sumInsured < 20_000_000) return 0.08;
  return 0.1;
}

/** 1% per full year with the insurer, capped at 7%. */
function tenureDiscount(customer: Customer, asOf: Date): number {
  const years = Math.max(0, Math.floor(yearsBetween(customer.customerSince, asOf)));
  return Math.min(0.07, years * 0.01);
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Price one policy.
 *
 * `claims` must be the claims belonging to `policy`. It is not filtered here:
 * `rateBook` groups the book once, and re-filtering the full claims array
 * inside every policy would turn an O(P + C) pass into O(P × C).
 */
export function ratePolicy(
  policy: Policy,
  customer: Customer,
  claims: readonly Claim[],
  asOf: Date = new Date(),
): PremiumBreakdown {
  // One shared grid for the policy, wide enough for several claims on every
  // line at once — that upper region is exactly where the tail lives.
  const totalLimit = policy.coverages.reduce((sum, c) => sum + c.limit, 0);
  const policyWidth = Math.max(1, (totalLimit * MAX_CLAIM_COUNT) / BUCKETS);

  let policyAgg: LossGrid = new Float64Array(BUCKETS);
  policyAgg[0] = 1;
  // Expectation is linear, so the mean is summed exactly from each line's own
  // (finer) grid rather than read off the coarse policy grid.
  let expectedLoss = 0;

  for (const coverage of policy.coverages) {
    const entry = CATALOGUE_BY_CODE.get(coverage.code);
    if (!entry) continue;

    // Each line gets a grid scaled to its own limit. A ₹1L ambulance rider on
    // a grid sized for a ₹3Cr sum insured would land entirely in bucket 0 and
    // price at zero — the rider would appear free in the quote wizard.
    const lineWidth = Math.max(1, (coverage.limit * MAX_CLAIM_COUNT) / BUCKETS);
    const sev = severityPmf(coverage, entry.severityMeanFraction, entry.severityCv, lineWidth);
    const lineAgg = compoundPmf(sev, entry.baseFrequency);

    expectedLoss += expectedValue(lineAgg, lineWidth);
    policyAgg = convolve(policyAgg, rebin(lineAgg, lineWidth, policyWidth));
  }

  const tvar95 = tailValueAtRisk(policyAgg, policyWidth, TVAR_LEVEL);
  const pvFactor = Math.pow(1 + DISCOUNT_RATE, -0.5);

  const riskPremium = expectedLoss * pvFactor;
  const riskMargin = Math.max(0, tvar95 - expectedLoss) * RISK_MARGIN_RATE * pvFactor;

  const manualPremium = (BASE_RATE_PER_MILLE[policy.type] * policy.sumInsured) / 1000;
  const technicalPremium =
    CREDIBILITY * (riskPremium + riskMargin) + (1 - CREDIBILITY) * manualPremium;

  const age = yearsBetween(customer.dateOfBirth, asOf);
  const loadings = {
    age: ageLoading(policy.type, age),
    claims: claimsLoading(policy, claims, asOf),
  };
  const discounts = {
    noClaimBonus: noClaimBonus(policy, claims, asOf),
    sumInsuredBand: sumInsuredBandDiscount(policy.sumInsured),
    tenure: tenureDiscount(customer, asOf),
  };

  const netPremium =
    technicalPremium *
    (1 + loadings.age + loadings.claims) *
    (1 - discounts.noClaimBonus) *
    (1 - discounts.sumInsuredBand) *
    (1 - discounts.tenure);

  const gross = netPremium / (1 - EXPENSE_RATIO);

  return {
    policyId: policy.id,
    expectedLoss,
    tvar95,
    riskPremium,
    riskMargin,
    manualPremium,
    technicalPremium,
    loadings,
    discounts,
    netPremium,
    expenseLoading: gross - netPremium,
    annualPremium: Math.round(gross / 10) * 10,
  };
}

/**
 * Price the whole book, keyed by policy id.
 *
 * The elapsed-time log is deliberate and load-bearing: it is how the
 * memoisation claim in Phase 2 gets evidence. With the `useMemo` in place this
 * logs once per data change; remove the `useMemo` and it logs on every
 * keystroke, with the same millisecond cost each time.
 */
export function rateBook(
  policies: readonly Policy[],
  customers: readonly Customer[],
  claims: readonly Claim[],
  asOf: Date = new Date(),
): Map<string, PremiumBreakdown> {
  const started = performance.now();

  const customerIndex = new Map(customers.map((c) => [c.id, c]));
  const claimIndex = new Map<string, Claim[]>();
  for (const claim of claims) {
    const bucket = claimIndex.get(claim.policyId);
    if (bucket) bucket.push(claim);
    else claimIndex.set(claim.policyId, [claim]);
  }

  const out = new Map<string, PremiumBreakdown>();
  for (const policy of policies) {
    const customer = customerIndex.get(policy.customerId);
    if (!customer) continue;
    out.set(policy.id, ratePolicy(policy, customer, claimIndex.get(policy.id) ?? [], asOf));
  }

  console.log(
    `[rating] rateBook ${policies.length} policies in ${(performance.now() - started).toFixed(1)}ms`,
  );
  return out;
}
