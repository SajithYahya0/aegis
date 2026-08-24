/**
 * WHY THIS EXISTS:
 *   `/policies/:id/documents`. Lists attached paperwork straight from the
 *   in-memory index — documents are static seed data with no async story of
 *   their own, unlike the Claims tab.
 *
 * CONCEPTS: (nested-route content — see PolicyDetailPage for W2-D4-03)
 *
 * WITHOUT THIS:
 *   The third leg of the Coverage/Claims/Documents nested-route trio would be
 *   missing, so the tab nav would link to a page that 404s.
 */

import type { ReactElement } from 'react';
import { useParams } from 'react-router-dom';
import { documentsByPolicyId, EMPTY } from '../../shared/data';
import { formatDate, formatFileSize } from '../../shared/format';

export default function PolicyDocumentsTab(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const documents = id ? (documentsByPolicyId.get(id) ?? EMPTY) : EMPTY;

  if (documents.length === 0) {
    return <p>No documents on file for this policy.</p>;
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Document</th>
          <th>Kind</th>
          <th>Size</th>
          <th>Uploaded</th>
        </tr>
      </thead>
      <tbody>
        {documents.map((doc) => (
          <tr key={doc.id}>
            <td>{doc.name}</td>
            <td>{doc.kind}</td>
            <td>{formatFileSize(doc.sizeBytes)}</td>
            <td>{formatDate(doc.uploadedAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
