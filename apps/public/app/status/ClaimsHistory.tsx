import type { ReactElement } from 'react';
import styles from '../aegis.module.css';
import { claimHistory } from '../../lib/book';
import { formatRupees } from '../../lib/rates';

export default async function ClaimsHistory({
  policyRef,
}: {
  policyRef: string;
}): Promise<ReactElement> {
  const claims = await claimHistory(policyRef);

  if (claims.length === 0) {
    return <p className={styles.note}>Nothing has ever been claimed against this policy.</p>;
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Claim</th>
          <th>Filed</th>
          <th>Peril</th>
          <th>Amount</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {claims.map((claim) => (
          <tr key={claim.ref}>
            <td>{claim.ref}</td>
            <td>{claim.filedOn}</td>
            <td>{claim.peril}</td>
            <td>{formatRupees(claim.amount)}</td>
            <td>{claim.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
