import type { Product } from './rates';

export interface PublicPolicy {
  ref: string;
  holder: string;
  surname: string;
  product: Product;
  status: 'In force' | 'Lapsed' | 'Awaiting renewal';
  sumInsured: number;
  premium: number;
  coverTo: string;
}

export interface PublicClaim {
  ref: string;
  filedOn: string;
  peril: string;
  amount: number;
  status: 'Settled' | 'Under review' | 'Declined';
}

const POLICIES: readonly PublicPolicy[] = [
  { ref: 'POL-1001', holder: 'Priya Nair', surname: 'nair', product: 'motor',
    status: 'Awaiting renewal', sumInsured: 850_000, premium: 20_830, coverTo: '2026-10-01' },
  { ref: 'POL-1002', holder: 'Rohit Menon', surname: 'menon', product: 'health',
    status: 'In force', sumInsured: 1_200_000, premium: 37_200, coverTo: '2027-05-11' },
  { ref: 'POL-1005', holder: 'Sneha Iyer', surname: 'iyer', product: 'motor',
    status: 'Lapsed', sumInsured: 640_000, premium: 16_940, coverTo: '2026-08-02' },
  { ref: 'POL-1007', holder: 'Fatima Sheikh', surname: 'sheikh', product: 'property',
    status: 'In force', sumInsured: 9_400_000, premium: 42_300, coverTo: '2027-01-12' },
];

const CLAIMS: Readonly<Record<string, readonly PublicClaim[]>> = {
  'POL-1001': [
    { ref: 'CLM-5001', filedOn: '2026-02-16', peril: 'Accident', amount: 62_000,
      status: 'Settled' },
    { ref: 'CLM-5002', filedOn: '2026-05-16', peril: 'Theft', amount: 18_500,
      status: 'Declined' },
  ],
  'POL-1002': [
    { ref: 'CLM-5003', filedOn: '2026-06-10', peril: 'Hospitalisation', amount: 145_000,
      status: 'Settled' },
  ],
  'POL-1005': [
    { ref: 'CLM-5005', filedOn: '2025-12-26', peril: 'Accident', amount: 210_000,
      status: 'Settled' },
    { ref: 'CLM-5006', filedOn: '2026-04-26', peril: 'Accident', amount: 96_000,
      status: 'Settled' },
  ],
  'POL-1007': [
    { ref: 'CLM-5008', filedOn: '2026-07-30', peril: 'Flood', amount: 1_150_000,
      status: 'Under review' },
  ],
};

const ADMIN_SYSTEM_MS = 220;
const CLAIMS_SYSTEM_MS = 1_600;

function later<T>(value: T, ms: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export async function findPolicy(ref: string, surname: string): Promise<PublicPolicy | null> {
  const wanted = ref.trim().toUpperCase();
  const name = surname.trim().toLowerCase();
  const match = POLICIES.find(
    (policy) => policy.ref === wanted && policy.surname === name,
  );
  return later(match ?? null, ADMIN_SYSTEM_MS);
}

export async function claimHistory(ref: string): Promise<readonly PublicClaim[]> {
  return later(CLAIMS[ref] ?? [], CLAIMS_SYSTEM_MS);
}
