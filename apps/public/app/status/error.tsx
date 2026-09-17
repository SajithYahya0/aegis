'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';
import styles from '../aegis.module.css';
import {useRouter} from 'next/navigation';

interface StatusErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function StatusError({ error, reset }: StatusErrorProps): ReactElement {
  const router = useRouter();
  return (
    <main>
      <h1>We could not look that up</h1>
      <p className={styles.lead}>
        Check the reference and the surname exactly as they appear on your schedule. If they are
        right, our policy system is briefly unavailable — try again in a moment.
      </p>
      <button type="button" className={styles.cta} onClick={() =>{ router.refresh();reset();}}>Try again</button>{' '}
      <Link href="/status">Search for a different policy</Link>
      {error.digest ? <p className={styles.note}>Quote reference {error.digest}.</p> : null}
    </main>
  );
}
