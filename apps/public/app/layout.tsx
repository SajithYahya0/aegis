import Link from 'next/link';
import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';
import styles from './aegis.module.css';

export const metadata: Metadata = {
  title: 'AEGIS Insurance — cover for motor, health, property and life',
  description:
    'Get an indicative premium in a minute, or check the status of a policy you already hold.',
};

export default function RootLayout({ children }: { children: ReactNode }): ReactElement {
  return (
    <html lang="en">
      <body>
        <div className={styles.shell}>
          <header className={styles.bar}>
            <Link href="/" className={styles.wordmark}>AEGIS</Link>
            <nav>
              <Link href="/quote">Get a quote</Link>
              <Link href="/status">Check a policy</Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
