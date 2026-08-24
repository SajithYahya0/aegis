/**
 * WHY THIS EXISTS:
 *   Proves `PolicyList` renders exactly the rows it is given — the piece
 *   `usePolicyFilters` depends on being true for the "filter narrows the
 *   table" story to hold end to end.
 *
 * CONCEPTS: W3-D2-07
 *
 * WITHOUT THIS:
 *   `usePolicyFilters`'s own filtering logic is a straightforward array
 *   `.filter()` and easy to trust by reading; what is not obvious by
 *   reading is whether `PolicyList` correctly reflects whatever array it
 *   receives — a stale `key` or a swapped prop could show the *previous*
 *   filtered set for a render. This closes that gap for the actual
 *   component the app renders, not just the hook's data.
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { Customer, Policy } from '../../shared/types';
import { PolicyList } from './PolicyList';

function makePolicy(overrides: Partial<Policy>): Policy {
  return {
    id: 'POL-00001',
    customerId: 'CUS-0001',
    type: 'motor',
    status: 'active',
    sumInsured: 500_000,
    startDate: '2025-01-01',
    endDate: '2026-01-01',
    coverages: [],
    claimIds: [],
    ...overrides,
  };
}

const customer: Customer = {
  id: 'CUS-0001',
  name: 'Asha Rao',
  email: 'asha@example.in',
  phone: '+91 9800000000',
  city: 'Pune',
  state: 'Maharashtra',
  dateOfBirth: '1990-01-01',
  customerSince: '2020-01-01',
};

const customersById = new Map([[customer.id, customer]]);
const premiumsById = new Map();

function renderList(policies: Policy[]) {
  return render(
    <MemoryRouter>
      <PolicyList
        policies={policies}
        customersById={customersById}
        premiumsById={premiumsById}
        onSelect={() => {}}
        isStale={false}
      />
    </MemoryRouter>,
  );
}

describe('PolicyList', () => {
  it('renders one row per policy, plus the header row', () => {
    const policies = [
      makePolicy({ id: 'POL-00001' }),
      makePolicy({ id: 'POL-00002' }),
      makePolicy({ id: 'POL-00003' }),
    ];

    renderList(policies);

    expect(screen.getAllByRole('row')).toHaveLength(policies.length + 1);
  });

  it('narrows to only the filtered policies', () => {
    const full = [makePolicy({ id: 'POL-00001' }), makePolicy({ id: 'POL-00002' })];
    const { unmount } = renderList(full);
    expect(screen.getAllByRole('row')).toHaveLength(3);
    unmount();

    const filtered = [makePolicy({ id: 'POL-00001' })];
    renderList(filtered);
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText('POL-00001')).toBeInTheDocument();
    expect(screen.queryByText('POL-00002')).not.toBeInTheDocument();
  });

  it('shows an empty message instead of a table when nothing matches', () => {
    renderList([]);
    expect(screen.getByText(/no policies match/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
