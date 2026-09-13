import { Suspense, type ReactElement } from 'react';
import styles from '../aegis.module.css';
import { findPolicy } from '../../lib/book';
import { PRODUCT_LABEL, formatRupees } from '../../lib/rates';
import ClaimsHistory from './ClaimsHistory';

export const dynamic = 'force-dynamic';

interface StatusPageProps {
  searchParams: Promise<{ ref?: string; surname?: string }>;
}

function LookupForm(): ReactElement {
  return (
    <form className={styles.form} method="get">
      <label className={styles.field}>
        <span>Policy reference</span>
        <input name="ref" required placeholder="POL-1001" />
      </label>
      <label className={styles.field}>
        <span>Surname on the policy</span>
        <input name="surname" required placeholder="Nair" />
      </label>
      <button type="submit" className={styles.cta}>Check status</button>
    </form>
  );
}

export default async function StatusPage({ searchParams }: StatusPageProps): Promise<ReactElement> {
  const { ref = '', surname = '' } = await searchParams;

  if (!ref || !surname) {
    return (
      <main>
        <h1>Check a policy</h1>
        <p className={styles.lead}>
          Enter the reference printed on your schedule and the surname it was issued in.
        </p>
        <LookupForm />
      </main>
    );
  }

  const policy = await findPolicy(ref, surname);

  if (!policy) {
    throw new Error(`No policy matching ${ref.toUpperCase()} was issued in that name.`);
  }

  return (
    <main>
      <h1>{policy.ref}</h1>
      <div className={styles.card}>
        <h2>{policy.holder} · {PRODUCT_LABEL[policy.product]}</h2>
        <p>
          {policy.status} · {formatRupees(policy.sumInsured)} insured ·{' '}
          {formatRupees(policy.premium)} a year · cover to {policy.coverTo}
        </p>
      </div>
      <h2>Claims history</h2>
      <Suspense
        fallback={<p className={styles.pending}>Fetching claims from the settlement system…</p>}
      >
        <ClaimsHistory policyRef={policy.ref} />
      </Suspense>
    </main>
  );
}
