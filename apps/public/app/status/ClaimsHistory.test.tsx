import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ClaimsHistory from './ClaimsHistory';

describe('ClaimsHistory', () => {
  it('renders the history the settlement system streams in behind the summary', async () => {
    render(await ClaimsHistory({ policyRef: 'POL-1001' }));

    expect(screen.getByText('CLM-5001')).toBeTruthy();
    expect(screen.getByText('CLM-5002')).toBeTruthy();
    expect(screen.getByText('₹62,000')).toBeTruthy();
    expect(screen.getByText('Declined')).toBeTruthy();
  });

  it('says so plainly when a policy has never been claimed against', async () => {
    render(await ClaimsHistory({ policyRef: 'POL-1003' }));

    expect(screen.getByText(/Nothing has ever been claimed against this policy/)).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
