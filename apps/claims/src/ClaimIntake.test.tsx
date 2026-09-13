import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClaimIntake from './ClaimIntake';
import type { PolicyOption } from './claimSchema';

const POLICIES: readonly PolicyOption[] = [
  { id: 'POL-1001', customerName: 'Priya Nair', sumInsured: 850_000 },
  { id: 'POL-1003', customerName: 'Aisha Qureshi', sumInsured: 18_500_000 },
];

const LOSS = 'Rear-ended at a signal; the bumper and boot lid need replacing.';

type User = ReturnType<typeof userEvent.setup>;

async function describeTheLoss(user: User): Promise<void> {
  await user.click(screen.getByRole('combobox', { name: /Policy/ }));
  await user.click(await screen.findByRole('option', { name: /POL-1003/ }));
  await user.type(screen.getByLabelText(/Amount claimed/), '48000');
  fireEvent.change(screen.getByLabelText(/Date of incident/), {
    target: { value: '2026-08-19' },
  });
  await user.type(screen.getByLabelText(/Claimant phone/), '+91 98400 12345');
  await user.type(screen.getByLabelText(/What happened/), LOSS);
}

describe('ClaimIntake', () => {
  it('holds the first notice on the incident step until the loss is described', async () => {
    const user = userEvent.setup();
    const onFile = vi.fn();
    render(<ClaimIntake policies={POLICIES} onFile={onFile} />);

    await user.click(screen.getByRole('button', { name: 'Review' }));

    expect(
      await screen.findByText('Select the policy this claim is filed against.'),
    ).toBeTruthy();
    expect(screen.getByText('Enter the date of the incident.')).toBeTruthy();
    expect(screen.getByText('Describe the loss in at least 20 characters.')).toBeTruthy();
    expect(onFile).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'File claim' })).toBeNull();
  });

  it('files the notice through the callback the host supplied', async () => {
    const user = userEvent.setup();
    const onFile = vi.fn().mockResolvedValue({ id: 'CLM-5100' });
    render(<ClaimIntake policies={POLICIES} onFile={onFile} />);

    await describeTheLoss(user);
    await user.click(screen.getByRole('button', { name: 'Review' }));

    expect(await screen.findByText(/POL-1003 · Accident/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'File claim' }));

    expect(await screen.findByText(/Claim CLM-5100 filed/)).toBeTruthy();
    expect(onFile).toHaveBeenCalledWith({
      policyId: 'POL-1003',
      type: 'accident',
      amount: 48_000,
      incidentDate: '2026-08-19',
      claimantPhone: '+91 98400 12345',
      description: LOSS,
    });
  });

  it('preselects the policy the console sent it', () => {
    render(<ClaimIntake policies={POLICIES} initialPolicyId="POL-1001" onFile={vi.fn()} />);

    expect(screen.getByRole('combobox', { name: /Policy/ }).textContent).toContain('POL-1001');
  });
});
