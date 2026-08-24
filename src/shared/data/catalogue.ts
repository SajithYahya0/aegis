/**
 * WHY THIS EXISTS:
 *   The product catalogue: which coverage lines exist per policy type, and the
 *   actuarial parameters each line carries (claim frequency, severity as a
 *   fraction of its limit, limit and deductible as fractions of sum insured).
 *   Both the seed builder and the quote wizard build coverages from here.
 *
 * CONCEPTS: W1-08
 *
 * WITHOUT THIS:
 *   The rating engine would need a hard-coded rate per policy type, so every
 *   motor policy with the same sum insured would price identically regardless
 *   of whether zero-depreciation was bought. The premium column on /policies
 *   would then show four distinct values across 120 rows, and the useMemo over
 *   `rateBook` (W3-D1-03) would look pointless because there is visibly
 *   nothing being computed. It would also give the quote wizard's coverage
 *   step nothing to render, and give `key={coverage.code}` (W1-08) no stable
 *   identity to key on.
 */

import type { ClaimType, PolicyType } from '../types';

export interface CatalogueEntry {
  /** Stable across reloads and safe as a React key. */
  code: string;
  label: string;
  /** Cannot be removed in the quote wizard. */
  mandatory: boolean;
  /** Expected claims per year for this line, before any risk loading. */
  baseFrequency: number;
  /** Mean single-claim size as a fraction of this line's limit. */
  severityMeanFraction: number;
  /** Coefficient of variation of single-claim severity. Drives the tail. */
  severityCv: number;
  /** This line's limit as a fraction of the policy's sum insured. */
  limitFraction: number;
  /** This line's deductible as a fraction of its own limit. */
  deductibleFraction: number;
  /** Claim types that plausibly arise under this line. */
  claimTypes: readonly ClaimType[];
}

/**
 * Base rate per ₹1,000 of sum insured, by product. Applied on top of the
 * modelled risk premium as the product's own margin/expense floor — a real
 * book does not price purely off the model.
 */
export const BASE_RATE_PER_MILLE: Record<PolicyType, number> = {
  motor: 24.5,
  health: 31.0,
  property: 4.5,
  life: 6.4,
};

export const CATALOGUE: Record<PolicyType, readonly CatalogueEntry[]> = {
  motor: [
    {
      code: 'MOTOR_OWN_DAMAGE',
      label: 'Own damage',
      mandatory: true,
      baseFrequency: 0.12,
      severityMeanFraction: 0.11,
      severityCv: 1.35,
      limitFraction: 1.0,
      deductibleFraction: 0.01,
      claimTypes: ['accident'],
    },
    {
      code: 'MOTOR_THIRD_PARTY',
      label: 'Third-party liability',
      mandatory: true,
      baseFrequency: 0.05,
      severityMeanFraction: 0.18,
      severityCv: 1.9,
      limitFraction: 0.75,
      deductibleFraction: 0,
      claimTypes: ['liability', 'accident'],
    },
    {
      code: 'MOTOR_THEFT',
      label: 'Theft & total loss',
      mandatory: false,
      baseFrequency: 0.006,
      severityMeanFraction: 0.82,
      severityCv: 0.45,
      limitFraction: 1.0,
      deductibleFraction: 0,
      claimTypes: ['theft'],
    },
    {
      code: 'MOTOR_ZERO_DEP',
      label: 'Zero depreciation',
      mandatory: false,
      baseFrequency: 0.08,
      severityMeanFraction: 0.09,
      severityCv: 1.1,
      limitFraction: 0.4,
      deductibleFraction: 0.02,
      claimTypes: ['accident'],
    },
    {
      code: 'MOTOR_PERSONAL_ACCIDENT',
      label: 'Owner personal accident',
      mandatory: false,
      baseFrequency: 0.003,
      severityMeanFraction: 0.6,
      severityCv: 1.5,
      limitFraction: 0.3,
      deductibleFraction: 0,
      claimTypes: ['accident', 'disability'],
    },
    {
      code: 'MOTOR_ROADSIDE',
      label: 'Roadside assistance',
      mandatory: false,
      baseFrequency: 0.25,
      severityMeanFraction: 0.2,
      severityCv: 0.6,
      limitFraction: 0.02,
      deductibleFraction: 0,
      claimTypes: ['other'],
    },
  ],
  health: [
    {
      code: 'HEALTH_HOSPITALISATION',
      label: 'In-patient hospitalisation',
      mandatory: true,
      baseFrequency: 0.075,
      severityMeanFraction: 0.22,
      severityCv: 1.25,
      limitFraction: 1.0,
      deductibleFraction: 0.03,
      claimTypes: ['hospitalisation'],
    },
    {
      code: 'HEALTH_PRE_POST',
      label: 'Pre & post hospitalisation',
      mandatory: true,
      baseFrequency: 0.07,
      severityMeanFraction: 0.18,
      severityCv: 0.9,
      limitFraction: 0.15,
      deductibleFraction: 0,
      claimTypes: ['hospitalisation'],
    },
    {
      code: 'HEALTH_DAYCARE',
      label: 'Day-care procedures',
      mandatory: false,
      baseFrequency: 0.05,
      severityMeanFraction: 0.21,
      severityCv: 0.85,
      limitFraction: 0.25,
      deductibleFraction: 0,
      claimTypes: ['hospitalisation'],
    },
    {
      code: 'HEALTH_CRITICAL_ILLNESS',
      label: 'Critical illness lump sum',
      mandatory: false,
      baseFrequency: 0.009,
      severityMeanFraction: 0.9,
      severityCv: 0.3,
      limitFraction: 0.5,
      deductibleFraction: 0,
      claimTypes: ['criticalIllness'],
    },
    {
      code: 'HEALTH_MATERNITY',
      label: 'Maternity & newborn',
      mandatory: false,
      baseFrequency: 0.025,
      severityMeanFraction: 0.55,
      severityCv: 0.4,
      limitFraction: 0.12,
      deductibleFraction: 0,
      claimTypes: ['hospitalisation'],
    },
    {
      code: 'HEALTH_AMBULANCE',
      label: 'Ambulance & evacuation',
      mandatory: false,
      baseFrequency: 0.03,
      severityMeanFraction: 0.4,
      severityCv: 0.7,
      limitFraction: 0.01,
      deductibleFraction: 0,
      claimTypes: ['hospitalisation', 'accident'],
    },
  ],
  property: [
    {
      code: 'PROPERTY_FIRE',
      label: 'Fire & allied perils',
      mandatory: true,
      baseFrequency: 0.008,
      severityMeanFraction: 0.3,
      severityCv: 2.1,
      limitFraction: 1.0,
      deductibleFraction: 0.02,
      claimTypes: ['fire'],
    },
    {
      code: 'PROPERTY_BURGLARY',
      label: 'Burglary & housebreaking',
      mandatory: true,
      baseFrequency: 0.021,
      severityMeanFraction: 0.12,
      severityCv: 1.4,
      limitFraction: 0.35,
      deductibleFraction: 0.01,
      claimTypes: ['theft'],
    },
    {
      code: 'PROPERTY_FLOOD',
      label: 'Flood & inundation',
      mandatory: false,
      baseFrequency: 0.014,
      severityMeanFraction: 0.28,
      severityCv: 1.75,
      limitFraction: 0.6,
      deductibleFraction: 0.05,
      claimTypes: ['flood'],
    },
    {
      code: 'PROPERTY_EARTHQUAKE',
      label: 'Earthquake',
      mandatory: false,
      baseFrequency: 0.004,
      severityMeanFraction: 0.66,
      severityCv: 2.4,
      limitFraction: 0.8,
      deductibleFraction: 0.1,
      claimTypes: ['other'],
    },
    {
      code: 'PROPERTY_CONTENTS',
      label: 'Contents & valuables',
      mandatory: false,
      baseFrequency: 0.03,
      severityMeanFraction: 0.16,
      severityCv: 1.2,
      limitFraction: 0.25,
      deductibleFraction: 0.02,
      claimTypes: ['theft', 'fire'],
    },
    {
      code: 'PROPERTY_LOSS_OF_RENT',
      label: 'Loss of rent',
      mandatory: false,
      baseFrequency: 0.013,
      severityMeanFraction: 0.45,
      severityCv: 0.65,
      limitFraction: 0.08,
      deductibleFraction: 0,
      claimTypes: ['other'],
    },
  ],
  life: [
    {
      code: 'LIFE_TERM_DEATH',
      label: 'Term death benefit',
      mandatory: true,
      baseFrequency: 0.0042,
      severityMeanFraction: 1.0,
      severityCv: 0.05,
      limitFraction: 1.0,
      deductibleFraction: 0,
      claimTypes: ['death'],
    },
    {
      code: 'LIFE_ACCIDENTAL_DEATH',
      label: 'Accidental death rider',
      mandatory: false,
      baseFrequency: 0.0009,
      severityMeanFraction: 1.0,
      severityCv: 0.05,
      limitFraction: 0.5,
      deductibleFraction: 0,
      claimTypes: ['death', 'accident'],
    },
    {
      code: 'LIFE_DISABILITY',
      label: 'Permanent disability rider',
      mandatory: false,
      baseFrequency: 0.0021,
      severityMeanFraction: 0.75,
      severityCv: 0.5,
      limitFraction: 0.4,
      deductibleFraction: 0,
      claimTypes: ['disability'],
    },
    {
      code: 'LIFE_TERMINAL_ILLNESS',
      label: 'Terminal illness acceleration',
      mandatory: false,
      baseFrequency: 0.0016,
      severityMeanFraction: 0.5,
      severityCv: 0.35,
      limitFraction: 0.5,
      deductibleFraction: 0,
      claimTypes: ['criticalIllness'],
    },
    {
      code: 'LIFE_WAIVER_PREMIUM',
      label: 'Waiver of premium',
      mandatory: false,
      baseFrequency: 0.0031,
      severityMeanFraction: 0.6,
      severityCv: 0.55,
      limitFraction: 0.05,
      deductibleFraction: 0,
      claimTypes: ['disability', 'criticalIllness'],
    },
    {
      code: 'LIFE_INCOME_BENEFIT',
      label: 'Family income benefit',
      mandatory: false,
      baseFrequency: 0.0038,
      severityMeanFraction: 0.85,
      severityCv: 0.25,
      limitFraction: 0.35,
      deductibleFraction: 0,
      claimTypes: ['death'],
    },
  ],
};

/** Flat lookup, so a coverage code on a claim or quote resolves without a scan. */
export const CATALOGUE_BY_CODE: ReadonlyMap<string, CatalogueEntry> = new Map(
  Object.values(CATALOGUE)
    .flat()
    .map((entry) => [entry.code, entry] as const),
);

/* -------------------------------------------------------------------------- */
/* Name and place pools for the seed builder                                  */
/* -------------------------------------------------------------------------- */

export const FIRST_NAMES = [
  'Aarav', 'Divya', 'Rohan', 'Meera', 'Kabir', 'Ananya', 'Vikram', 'Priya',
  'Arjun', 'Nisha', 'Rahul', 'Sneha', 'Karthik', 'Lakshmi', 'Imran', 'Fatima',
  'Sanjay', 'Ritu', 'Aditya', 'Kavya', 'Nikhil', 'Pooja', 'Suresh', 'Tanvi',
  'Manish', 'Ishita', 'Deepak', 'Aisha', 'Varun', 'Shreya',
] as const;

export const LAST_NAMES = [
  'Sharma', 'Iyer', 'Nair', 'Reddy', 'Menon', 'Kulkarni', 'Banerjee', 'Chatterjee',
  'Gupta', 'Desai', 'Pillai', 'Rao', 'Joshi', 'Verma', 'Khan', 'Patel',
  'Mukherjee', 'Bhatt', 'Naidu', 'Sethi',
] as const;

export const PLACES = [
  { city: 'Chennai', state: 'Tamil Nadu' },
  { city: 'Coimbatore', state: 'Tamil Nadu' },
  { city: 'Bengaluru', state: 'Karnataka' },
  { city: 'Mysuru', state: 'Karnataka' },
  { city: 'Hyderabad', state: 'Telangana' },
  { city: 'Kochi', state: 'Kerala' },
  { city: 'Thiruvananthapuram', state: 'Kerala' },
  { city: 'Mumbai', state: 'Maharashtra' },
  { city: 'Pune', state: 'Maharashtra' },
  { city: 'Ahmedabad', state: 'Gujarat' },
  { city: 'Jaipur', state: 'Rajasthan' },
  { city: 'New Delhi', state: 'Delhi' },
  { city: 'Kolkata', state: 'West Bengal' },
  { city: 'Bhubaneswar', state: 'Odisha' },
] as const;

/** Short, plausible claim narratives keyed by claim type. */
export const CLAIM_NARRATIVES: Record<ClaimType, readonly string[]> = {
  accident: [
    'Rear-end collision at signalled junction; front bumper and radiator damaged.',
    'Single-vehicle skid in wet conditions; nearside panels and mirror replaced.',
    'Parked vehicle struck by third party; no driver present at time of loss.',
  ],
  theft: [
    'Vehicle stolen from unattended residential parking; FIR lodged same day.',
    'Forced entry via rear window; electronics and jewellery removed.',
    'Total loss following theft; vehicle not recovered within statutory period.',
  ],
  fire: [
    'Electrical short circuit in distribution board; kitchen and adjoining wall damaged.',
    'Fire spread from neighbouring unit; smoke damage throughout ground floor.',
  ],
  flood: [
    'Monsoon inundation to 0.8m; ground-floor contents and flooring written off.',
    'Storm-water backflow through drainage; structural drying and repaint required.',
  ],
  hospitalisation: [
    'Elective laparoscopic procedure; three-day in-patient stay.',
    'Emergency admission for acute appendicitis; surgery on day of admission.',
    'Cardiac evaluation and angioplasty; two-day intensive care.',
  ],
  criticalIllness: [
    'First diagnosis of a listed condition; lump-sum benefit claimed on confirmation.',
    'Oncology diagnosis confirmed by histopathology; benefit claimed under rider.',
  ],
  death: [
    'Death benefit claimed by nominee; certificate and KYC submitted.',
    'Accidental death claim; police report and post-mortem findings enclosed.',
  ],
  disability: [
    'Permanent partial disability certified at 42% by medical board.',
    'Loss of use of right hand following industrial accident.',
  ],
  liability: [
    'Third-party bodily injury claim following road traffic accident.',
    'Third-party property damage; boundary wall of adjoining premises.',
  ],
  other: [
    'Roadside recovery and towing following breakdown on national highway.',
    'Loss of rent during reinstatement period following an insured peril.',
    'Miscellaneous loss; assessor report pending.',
  ],
};
