import Link from 'next/link';
import type { ReactElement } from 'react';
import styles from './aegis.module.css';
import { PRODUCTS, PRODUCT_LABEL } from '../lib/rates';

export const dynamic = 'force-static';

const PITCH: Record<string, string> = {
  motor: 'Own damage and third-party cover, with an optional zero-depreciation add-on.',
  health: 'In-patient and day-care treatment, with maternity cover you can add on.',
  property: 'Fire and allied perils, burglary, and flood cover for the monsoon months.',
  life: 'Term cover with accidental death and critical illness riders.',
};

export default function HomePage(): ReactElement {
  
  return (
    
    <main>
      
      <h1>Cover that settles when it matters.</h1>
      <p className={styles.lead}>
        AEGIS writes motor, health, property and life cover across India. Rates are filed with
        the regulator and republished every hour, so the number you see is the number we bind.
      </p>
      <Link href="/quote" className={styles.cta}>Get an indicative quote</Link>{' '}
      <Link href="/status">or check a policy you already hold</Link>
      <div className={styles.grid}>
        {PRODUCTS.map((product) => (
          <section key={product} className={styles.card}>
            <h2>{PRODUCT_LABEL[product]}</h2>
            <p>{PITCH[product]}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
