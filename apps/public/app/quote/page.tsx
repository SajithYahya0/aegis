import { Suspense, type ReactElement } from 'react';
import styles from '../aegis.module.css';
import { currentRateCard } from '../../lib/rates';
import QuoteForm from './QuoteForm';

export const revalidate = 3600;

export default function QuotePage(): ReactElement {
  const rateCard = currentRateCard();

  return (
    <main>
      <h1>Get an indicative quote</h1>
      <p className={styles.lead}>
        The premium below is priced off the rate card we publish at the top of every hour. It is
        indicative: a broker confirms it before cover is bound.
      </p>
      <Suspense fallback={<p className={styles.pending}>Loading this hour&rsquo;s rates…</p>}>
        <QuoteForm rateCard={rateCard} />
      </Suspense>
    </main>
  );
}
