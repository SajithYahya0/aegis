/**
 * WHY THIS EXISTS:
 *   The single vocabulary for the whole console. Every route, hook, reducer and
 *   test speaks in these shapes, so `src/shared/data`, `src/shared/api.ts` and
 *   `src/shared/rating.ts` cannot drift apart.
 *
 * CONCEPTS: W1-03
 *
 * WITHOUT THIS:
 *   Each route re-declares its own idea of a Policy. The moment one of them
 *   spells the status `"cancelled"` and another `"canceled"`, the status filter
 *   on /policies silently returns zero rows with no type error to catch it,
 *   and the status-colour CSS Module class lookup returns `undefined` so the
 *   badge renders unstyled. Typed prop interfaces (W1-03) are only worth
 *   anything if there is one definition of the thing being passed.
 */

/* -------------------------------------------------------------------------- */
/* Identity & access                                                          */
/* -------------------------------------------------------------------------- */

/**
 * An `agent` sells and services policies. An `underwriter` additionally prices
 * risk and approves claims — that is what /underwriting is gated on.
 */
export type Role = 'agent' | 'underwriter';

export interface User {
  id: string;
  name: string;
  role: Role;
  branch: string;
}

/* -------------------------------------------------------------------------- */
/* Core domain                                                                */
/* -------------------------------------------------------------------------- */

export type PolicyType = 'motor' | 'health' | 'property' | 'life';

export type PolicyStatus = 'active' | 'lapsed' | 'pending' | 'cancelled';

export type ClaimStatus =
  | 'draft'
  | 'submitted'
  | 'underReview'
  | 'approved'
  | 'rejected';

export type ClaimType =
  | 'accident'
  | 'theft'
  | 'fire'
  | 'flood'
  | 'hospitalisation'
  | 'criticalIllness'
  | 'death'
  | 'disability'
  | 'liability'
  | 'other';

/**
 * All dates are ISO-8601 date strings, never `Date` objects.
 *
 * This is deliberate: the quote draft is round-tripped through localStorage by
 * `useReducer`'s lazy initialiser (W2-D3-03). `JSON.stringify(new Date())`
 * produces a string, and `JSON.parse` gives that string back — never a Date.
 * A `Date`-typed field would therefore be a lie the moment a draft is
 * rehydrated, and `draft.startDate.getFullYear()` would throw
 * "is not a function" on reload only. Parsing happens at the edge, via
 * `date-fns/parseISO`, not in the type.
 */
export type IsoDate = string;

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  /** Used for the age loading in the rating engine. */
  dateOfBirth: IsoDate;
  /** First policy written for this customer — drives the tenure discount. */
  customerSince: IsoDate;
}

/**
 * One priced line inside a policy. `limit` and `deductible` are absolute
 * rupee amounts, not fractions, because the rating engine convolves them onto
 * a shared bucket grid and a fraction would have to be re-expanded per policy.
 */
export interface Coverage {
  id: string;
  /** Stable catalogue code, e.g. `MOTOR_OWN_DAMAGE`. Safe to use as a key. */
  code: string;
  label: string;
  /** Maximum payable under this line, in rupees. */
  limit: number;
  /** Borne by the insured before this line pays, in rupees. */
  deductible: number;
  /** Optional add-ons can be switched off in the quote wizard. */
  mandatory: boolean;
}

export interface Policy {
  id: string;
  customerId: string;
  type: PolicyType;
  status: PolicyStatus;
  /** Aggregate limit across all coverages, in rupees. */
  sumInsured: number;
  startDate: IsoDate;
  endDate: IsoDate;
  coverages: Coverage[];
  /** Denormalised for O(1) lookup from a policy row; the claim is the source. */
  claimIds: string[];
}

export interface Claim {
  id: string;
  policyId: string;
  type: ClaimType;
  /** Amount claimed, in rupees. Not necessarily the amount paid. */
  amount: number;
  status: ClaimStatus;
  filedAt: IsoDate;
  description: string;
}

/**
 * Attached paperwork, listed on the Documents tab of /policies/:id.
 */
export interface PolicyDocument {
  id: string;
  policyId: string;
  name: string;
  kind: 'schedule' | 'endorsement' | 'invoice' | 'claimForm' | 'kyc';
  sizeBytes: number;
  uploadedAt: IsoDate;
}

/* -------------------------------------------------------------------------- */
/* Quote wizard                                                               */
/* -------------------------------------------------------------------------- */

export type QuoteStep = 'applicant' | 'risk' | 'coverage' | 'review';

/**
 * One insured party. The wizard allows several, which is exactly why the
 * label/input pairing inside the fieldset needs `useId` (C-01): three
 * hard-coded `id="fullName"` attributes on one page make every label point at
 * the first input, so clicking the third label focuses the wrong field and
 * screen readers announce the wrong name.
 */
export interface InsuredParty {
  /** Client-side only; stable across re-orders so it can be a React key. */
  key: string;
  fullName: string;
  dateOfBirth: IsoDate;
  relationship: 'self' | 'spouse' | 'child' | 'parent' | 'other';
}

/**
 * The quote wizard's entire state. This is the object the reducer returns and
 * the object that is persisted to localStorage, so every field must be
 * JSON-safe — see the note on `IsoDate`.
 */
export interface Quote {
  id: string;
  step: QuoteStep;
  type: PolicyType;
  sumInsured: number;
  /** Policy term in months. */
  termMonths: number;
  city: string;
  state: string;
  insured: InsuredParty[];
  /** Catalogue codes the applicant has opted into, beyond the mandatory ones. */
  selectedCoverageCodes: string[];
  /** Declared prior claims in the last 3 years — feeds the claims loading. */
  priorClaims: number;
  createdAt: IsoDate;
  updatedAt: IsoDate;
}
