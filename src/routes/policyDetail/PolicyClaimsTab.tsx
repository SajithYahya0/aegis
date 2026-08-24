/**
 * WHY THIS EXISTS:
 *   `/policies/:id/claims`. Phase 1 placeholder that reads straight from the
 *   in-memory index — Phase 3 replaces this body with `useFetch` +
 *   `AbortController` so the claims history load and refetch-on-navigate
 *   story (W2-D1-01…03) has somewhere real to live.
 *
 * CONCEPTS: (nested-route content — see PolicyDetailPage for W2-D4-03)
 *
 * WITHOUT THIS:
 *   The Claims tab of the nested route table would 404 into the catch-all
 *   route instead of rendering, and there would be nothing to point Phase 3's
 *   `useFetch` work at.
 */

import type { ReactElement } from 'react';
import { useParams } from 'react-router-dom';
import { claimsByPolicyId, EMPTY } from '../../shared/data';
import { CLAIM_STATUS_LABEL, formatCurrency, formatDate } from '../../shared/format';

export default function PolicyClaimsTab(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const claims = id ? (claimsByPolicyId.get(id) ?? EMPTY) : EMPTY;

  if (claims.length === 0) {
    return <p>No claims filed against this policy.</p>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Claim</th>
          <th>Type</th>
          <th>Amount</th>
          <th>Status</th>
          <th>Filed</th>
        </tr>
      </thead>
      <tbody>
        {claims.map((claim) => (
          <tr key={claim.id}>
            <td>{claim.id}</td>
            <td>{claim.type}</td>
            <td>{formatCurrency(claim.amount)}</td>
            <td>{CLAIM_STATUS_LABEL[claim.status]}</td>
            <td>{formatDate(claim.filedAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
