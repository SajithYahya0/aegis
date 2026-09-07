import type { Claim, Customer, Policy, PolicyDocument } from '../types';
import { buildBook } from './seed';

const book = buildBook();

/** Valuation date the whole book is dated against. Shown in the app header. */
export const AS_OF: string = book.asOf;

export const customers: readonly Customer[] = book.customers;
export const policies: readonly Policy[] = book.policies;
export const claims: readonly Claim[] = book.claims;
export const documents: readonly PolicyDocument[] = book.documents;

export const customersById: ReadonlyMap<string, Customer> = new Map(
  book.customers.map((c) => [c.id, c]),
);

export const policiesById: ReadonlyMap<string, Policy> = new Map(
  book.policies.map((p) => [p.id, p]),
);

export const claimsById: ReadonlyMap<string, Claim> = new Map(
  book.claims.map((c) => [c.id, c]),
);

export const policiesByCustomerId: ReadonlyMap<string, readonly Policy[]> = groupBy(
  book.policies,
  (p) => p.customerId,
);

export const claimsByPolicyId: ReadonlyMap<string, readonly Claim[]> = groupBy(
  book.claims,
  (c) => c.policyId,
);

export const documentsByPolicyId: ReadonlyMap<string, readonly PolicyDocument[]> = groupBy(
  book.documents,
  (d) => d.policyId,
);

function groupBy<T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const bucket = out.get(key);
    if (bucket) bucket.push(item);
    else out.set(key, [item]);
  }
  return out;
}

/**
 * Empty-array singleton for "this policy has no claims / no documents".
 *
 * Returning a fresh `[]` from a lookup miss is the classic referential-equality
 * trap: `claimsByPolicyId.get(id) ?? []` hands back a new array identity on
 * every render, so a `useMemo`/`useEffect` that depends on it re-runs forever
 * and a memoised child that receives it always re-renders. One frozen instance
 * keeps the identity stable.
 */
export const EMPTY: readonly never[] = Object.freeze([]);

export { buildBook, SEED } from './seed';
export { CATALOGUE, CATALOGUE_BY_CODE, BASE_RATE_PER_MILLE } from './catalogue';
export type { CatalogueEntry } from './catalogue';
