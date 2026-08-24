/**
 * WHY THIS EXISTS:
 *   The policy book, filterable by free text, status and type. Phase 1 wires
 *   the filters to the URL via `useSearchParams` — the concept this phase
 *   owns — and renders a plain filtered list. `React.memo` on the row,
 *   `useDeferredValue` on the list and the debounced search input all belong
 *   to Phase 2, once there is a keystroke-cost story to make them worth
 *   having.
 *
 * CONCEPTS: W2-D4-07
 *
 * WITHOUT THIS:
 *   Filter state held in local `useState` resets the moment the agent
 *   navigates away and back — clicking a row to open a policy and then
 *   pressing the browser's back button loses the search text and status
 *   filter they had set up. It also means the filtered view cannot be
 *   bookmarked or shared with a colleague as a link. Reading and writing
 *   `useSearchParams` instead makes the URL the source of truth, so both of
 *   those just work.
 */

import type { ChangeEvent, ReactElement } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { customersById, policies } from '../shared/data';
import { formatCurrency, POLICY_STATUS_LABEL, POLICY_TYPE_LABEL } from '../shared/format';
import type { PolicyStatus, PolicyType } from '../shared/types';

const STATUSES: readonly PolicyStatus[] = ['active', 'pending', 'lapsed', 'cancelled'];
const TYPES: readonly PolicyType[] = ['motor', 'health', 'property', 'life'];

export default function PoliciesPage(): ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();

  const query = searchParams.get('q') ?? '';
  const status = searchParams.get('status') ?? '';
  const type = searchParams.get('type') ?? '';

  function updateParam(key: string, value: string): void {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  }

  const needle = query.trim().toLowerCase();
  const filtered = policies.filter((policy) => {
    if (status && policy.status !== status) return false;
    if (type && policy.type !== type) return false;
    if (needle) {
      const customer = customersById.get(policy.customerId);
      const haystack = `${policy.id} ${customer?.name ?? ''}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  return (
    <div>
      <h1>Policies</h1>

      <div>
        <input
          type="search"
          placeholder="Search policy id or customer name"
          value={query}
          onChange={(event: ChangeEvent<HTMLInputElement>) => updateParam('q', event.target.value)}
        />
        <select value={status} onChange={(event) => updateParam('status', event.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {POLICY_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select value={type} onChange={(event) => updateParam('type', event.target.value)}>
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {POLICY_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </div>

      <p>
        {filtered.length} of {policies.length} policies
      </p>

      <table>
        <thead>
          <tr>
            <th>Policy</th>
            <th>Customer</th>
            <th>Type</th>
            <th>Status</th>
            <th>Sum insured</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((policy) => (
            <tr key={policy.id}>
              <td>
                <Link to={`/policies/${policy.id}`}>{policy.id}</Link>
              </td>
              <td>{customersById.get(policy.customerId)?.name ?? '—'}</td>
              <td>{POLICY_TYPE_LABEL[policy.type]}</td>
              <td>{POLICY_STATUS_LABEL[policy.status]}</td>
              <td>{formatCurrency(policy.sumInsured)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
