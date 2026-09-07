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
