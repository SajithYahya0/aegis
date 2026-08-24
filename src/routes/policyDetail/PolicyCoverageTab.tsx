/**
 * WHY THIS EXISTS:
 *   The default (index) child route under `/policies/:id`. Lists the
 *   coverage lines actually embedded on the policy — no fetch needed, since
 *   `coverages` already lives on the `Policy` object the seed data builds.
 *
 * CONCEPTS: (nested-route content — see PolicyDetailPage for W2-D4-03)
 *
 * WITHOUT THIS:
 *   `PolicyDetailPage`'s index `<Route>` would have nothing to render, so
 *   visiting `/policies/POL-00007` would show tabs above an empty content
 *   area — the nested-route wiring would be unverifiable by looking at the
 *   page.
 */

import type { ReactElement } from 'react';
import { useParams } from 'react-router-dom';
import { policiesById } from '../../shared/data';
import { formatCurrency } from '../../shared/format';

export default function PolicyCoverageTab(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const policy = id ? policiesById.get(id) : undefined;

  if (!policy) {
    return <p>Policy not found.</p>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Coverage</th>
          <th>Limit</th>
          <th>Deductible</th>
          <th>Mandatory</th>
        </tr>
      </thead>
      <tbody>
        {policy.coverages.map((coverage) => (
          <tr key={coverage.id}>
            <td>{coverage.label}</td>
            <td>{formatCurrency(coverage.limit)}</td>
            <td>{formatCurrency(coverage.deductible)}</td>
            <td>{coverage.mandatory ? 'Yes' : 'Optional'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
