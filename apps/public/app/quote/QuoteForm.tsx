'use client';

import { use, useState, type FormEvent, type ReactElement } from 'react';
import styles from '../aegis.module.css';
import {
  PRODUCTS, PRODUCT_LABEL, formatRupees, quotePremium, type Product, type RateCard,
} from '../../lib/rates';

const TERMS = [12, 24, 36];

export default function QuoteForm({ rateCard }: { rateCard: Promise<RateCard> }): ReactElement {
  const card = use(rateCard);
  const [product, setProduct] = useState<Product>('motor');
  const [sumInsured, setSumInsured] = useState(500_000);
  const [termMonths, setTermMonths] = useState(12);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [reference, setReference] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const premium = quotePremium(card, product, sumInsured, termMonths);

  async function requestCallback(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSending(true);
    setFailure(null);
    try {
      const response = await fetch('/api/quote-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, phone, city, policyType: product, sumInsured, indicativePremium: premium,
        }),
      });
      const body = (await response.json()) as { id?: string; message?: string };
      if (!response.ok) throw new Error(body.message ?? 'We could not record your request.');
      setReference(body.id ?? null);
    } catch (thrown) {
      setFailure(thrown instanceof Error ? thrown.message : 'We could not record your request.');
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={requestCallback}>
      <div className={styles.form}>
        <label className={styles.field}>
          <span>Cover</span>
          <select value={product} onChange={(event) => setProduct(event.target.value as Product)}>
            {PRODUCTS.map((value) => (
              <option key={value} value={value}>{PRODUCT_LABEL[value]}</option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Sum insured (₹)</span>
          <input
            type="number"
            min={50_000}
            step={50_000}
            value={sumInsured}
            onChange={(event) => setSumInsured(Number(event.target.value))}
          />
        </label>
        <label className={styles.field}>
          <span>Term</span>
          <select
            value={termMonths}
            onChange={(event) => setTermMonths(Number(event.target.value))}
          >
            {TERMS.map((months) => (
              <option key={months} value={months}>{months} months</option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.premium}>
        <span className={styles.note}>Indicative annual premium</span>
        <strong>{formatRupees(premium)}</strong>
        <span className={styles.note}>
          Rate card published {new Date(card.publishedAt).toUTCString()} ·{' '}
          {card.perMille[product]} per ₹1,000 insured
        </span>
      </div>

      <div className={styles.form}>
        <label className={styles.field}>
          <span>Your name</span>
          <input required value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Phone</span>
          <input
            required
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>City</span>
          <input required value={city} onChange={(event) => setCity(event.target.value)} />
        </label>
        <button type="submit" className={styles.cta} disabled={sending}>
          {sending ? 'Sending…' : 'Ask a broker to call'}
        </button>
      </div>

      {reference ? (
        <p className={styles.note}>
          Thank you — your enquiry is {reference}. A broker will call {phone} shortly.
        </p>
      ) : null}
      {failure ? <p className={styles.note}>{failure}</p> : null}
    </form>
  );
}
