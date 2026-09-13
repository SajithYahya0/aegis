import { annualPremium, coveragesFor } from './rating';
import type { Claim, Policy, PolicyStatus, PolicyType } from './domain';

const DAY_MS = 86_400_000;

function isoInDays(days: number): string {
  return new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10);
}

interface PolicySeed {
  id: string;
  customerName: string;
  city: string;
  type: PolicyType;
  status: PolicyStatus;
  sumInsured: number;
  endsInDays: number;
  termMonths: number;
  optionalCovers: number;
}

const HOUSEHOLDS: readonly PolicySeed[] = [
  { id: 'POL-1001', customerName: 'Priya Nair', city: 'Chennai', type: 'motor',
    status: 'active', sumInsured: 850_000, endsInDays: 18, termMonths: 12, optionalCovers: 1 },
  { id: 'POL-1002', customerName: 'Rohit Menon', city: 'Chennai', type: 'health',
    status: 'active', sumInsured: 1_200_000, endsInDays: 240, termMonths: 12, optionalCovers: 0 },
  { id: 'POL-1003', customerName: 'Aisha Qureshi', city: 'Mumbai', type: 'property',
    status: 'pending', sumInsured: 18_500_000, endsInDays: 305, termMonths: 12, optionalCovers: 1 },
  { id: 'POL-1004', customerName: 'Vikram Desai', city: 'Mumbai', type: 'life',
    status: 'active', sumInsured: 25_000_000, endsInDays: 640, termMonths: 24, optionalCovers: 2 },
  { id: 'POL-1005', customerName: 'Sneha Iyer', city: 'Bengaluru', type: 'motor',
    status: 'lapsed', sumInsured: 640_000, endsInDays: -42, termMonths: 12, optionalCovers: 0 },
  { id: 'POL-1006', customerName: 'Arjun Bhat', city: 'Bengaluru', type: 'health',
    status: 'active', sumInsured: 2_000_000, endsInDays: 27, termMonths: 12, optionalCovers: 1 },
  { id: 'POL-1007', customerName: 'Fatima Sheikh', city: 'Hyderabad', type: 'property',
    status: 'active', sumInsured: 9_400_000, endsInDays: 121, termMonths: 12, optionalCovers: 0 },
  { id: 'POL-1008', customerName: 'Karthik Raman', city: 'Chennai', type: 'motor',
    status: 'cancelled', sumInsured: 410_000, endsInDays: -180, termMonths: 12, optionalCovers: 0 },
  { id: 'POL-1009', customerName: 'Meera Joshi', city: 'Pune', type: 'health',
    status: 'pending', sumInsured: 3_500_000, endsInDays: 9, termMonths: 12, optionalCovers: 1 },
  { id: 'POL-1010', customerName: 'Sanjay Kulkarni', city: 'Pune', type: 'life',
    status: 'active', sumInsured: 12_000_000, endsInDays: 400, termMonths: 36, optionalCovers: 1 },
  { id: 'POL-1011', customerName: 'Divya Pillai', city: 'Kochi', type: 'property',
    status: 'active', sumInsured: 6_200_000, endsInDays: 22, termMonths: 12, optionalCovers: 2 },
  { id: 'POL-1012', customerName: 'Imran Khan', city: 'Hyderabad', type: 'motor',
    status: 'active', sumInsured: 1_150_000, endsInDays: 88, termMonths: 12, optionalCovers: 2 },
];

const PER_HOUSEHOLD = 20;
const GIVEN_NAMES = ['Anand', 'Bhavna', 'Chetan', 'Deepa', 'Ekta', 'Farhan', 'Gita', 'Harish',
  'Ishaan', 'Jaya', 'Kiran', 'Lata', 'Manoj', 'Nisha', 'Omkar', 'Pooja', 'Rahul'];
const SUM_FACTORS = [0.55, 0.7, 0.9, 1.25, 1.6, 2.1];
const END_OFFSETS = [-172, -61, -9, 4, 13, 26, 58, 97, 154, 231, 318, 409, 615];
const STATUS_CYCLE: readonly PolicyStatus[] = ['active', 'active', 'pending', 'active', 'lapsed',
  'active', 'active', 'cancelled'];
const TERM_CYCLE = [12, 12, 24, 12, 36];

const SEED: readonly PolicySeed[] = HOUSEHOLDS.flatMap((household, index) =>
  Array.from({ length: PER_HOUSEHOLD }, (_, offset) => {
    if (offset === 0) return household;
    const n = index * PER_HOUSEHOLD + offset;
    const surname = household.customerName.split(' ')[1];
    return {
      ...household,
      id: `POL-${2000 + n}`,
      customerName: `${GIVEN_NAMES[n % GIVEN_NAMES.length]} ${surname}`,
      status: STATUS_CYCLE[n % STATUS_CYCLE.length],
      sumInsured: Math.round(household.sumInsured * SUM_FACTORS[n % SUM_FACTORS.length]),
      endsInDays: END_OFFSETS[n % END_OFFSETS.length],
      termMonths: TERM_CYCLE[n % TERM_CYCLE.length],
      optionalCovers: n % 3,
    };
  }),
);

export const claims: Claim[] = [
  { id: 'CLM-5001', policyId: 'POL-1001', type: 'accident', amount: 62_000, status: 'approved',
    filedAt: isoInDays(-210),
    description: 'Rear-ended at a signal on Mount Road; bumper and boot lid replaced.' },
  { id: 'CLM-5002', policyId: 'POL-1001', type: 'theft', amount: 18_500, status: 'rejected',
    filedAt: isoInDays(-120),
    description: 'Side mirrors taken from an unattended parking lot overnight.' },
  { id: 'CLM-5003', policyId: 'POL-1002', type: 'hospitalisation', amount: 145_000,
    status: 'approved', filedAt: isoInDays(-95),
    description: 'Four-day admission for dengue with platelet transfusion.' },
  { id: 'CLM-5004', policyId: 'POL-1003', type: 'fire', amount: 4_800_000, status: 'underReview',
    filedAt: isoInDays(-30),
    description: 'Short circuit in the warehouse loft destroyed stored inventory.' },
  { id: 'CLM-5005', policyId: 'POL-1005', type: 'accident', amount: 210_000, status: 'approved',
    filedAt: isoInDays(-260),
    description: 'Collision with a divider on the ring road; front assembly written off.' },
  { id: 'CLM-5006', policyId: 'POL-1005', type: 'accident', amount: 96_000, status: 'approved',
    filedAt: isoInDays(-140),
    description: 'Low-speed collision in basement parking; door panel replaced.' },
  { id: 'CLM-5007', policyId: 'POL-1006', type: 'hospitalisation', amount: 380_000,
    status: 'submitted', filedAt: isoInDays(-12),
    description: 'Planned knee arthroscopy with two nights of post-operative care.' },
  { id: 'CLM-5008', policyId: 'POL-1007', type: 'flood', amount: 1_150_000, status: 'underReview',
    filedAt: isoInDays(-45),
    description: 'Monsoon water ingress damaged ground-floor stock and wiring.' },
  { id: 'CLM-5009', policyId: 'POL-1011', type: 'fire', amount: 720_000, status: 'submitted',
    filedAt: isoInDays(-6),
    description: 'Kitchen fire spread to the adjoining store room before control.' },
  { id: 'CLM-5010', policyId: 'POL-1012', type: 'liability', amount: 265_000, status: 'underReview',
    filedAt: isoInDays(-21),
    description: 'Third-party two-wheeler rider injured; hospital bills claimed.' },
];

export const policies: Policy[] = SEED.map((seed) => {
  const priorClaims = claims.filter((claim) => claim.policyId === seed.id).length;
  return {
    id: seed.id,
    customerName: seed.customerName,
    city: seed.city,
    type: seed.type,
    status: seed.status,
    sumInsured: seed.sumInsured,
    annualPremium: annualPremium({
      type: seed.type,
      sumInsured: seed.sumInsured,
      termMonths: seed.termMonths,
      priorClaims,
      optionalCovers: seed.optionalCovers,
    }),
    startDate: isoInDays(seed.endsInDays - seed.termMonths * 30),
    endDate: isoInDays(seed.endsInDays),
    coverages: coveragesFor(seed.type, seed.sumInsured, seed.optionalCovers),
  };
});

export const UNDERWRITING_LIMITS = {
  autoBindLimit: 10_000_000,
  maxLoadingPct: 40,
  referralLossRatio: 0.25,
};
