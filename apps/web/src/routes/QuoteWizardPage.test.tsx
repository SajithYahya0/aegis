import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuoteWizardPage from './QuoteWizardPage';

type User = ReturnType<typeof userEvent.setup>;

async function completeApplicant(user: User): Promise<void> {
  await user.type(screen.getByLabelText(/^City/), 'Chennai');
  await user.click(screen.getByRole('button', { name: 'Add insured party' }));
  await user.type(screen.getByLabelText(/Insured 1 name/), 'Priya Nair');
  fireEvent.change(screen.getByLabelText(/Date of birth/), { target: { value: '1990-04-12' } });
  await user.click(screen.getByRole('button', { name: 'Next' }));
}

describe('QuoteWizardPage', () => {
  it('holds an incomplete applicant on the first step and says what is missing', async () => {
    const user = userEvent.setup();
    render(<QuoteWizardPage />);

    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Enter the city where the risk sits.')).toBeTruthy();

    await user.type(screen.getByLabelText(/^City/), 'Chennai');
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('Add at least one insured party.')).toBeTruthy();
    expect(screen.getByLabelText(/^City/)).toBeTruthy();
  });

  it('reprices the premium bar when an optional cover is bought', async () => {
    const user = userEvent.setup();
    render(<QuoteWizardPage />);

    await completeApplicant(user);
    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('₹12,250')).toBeTruthy();

    await user.click(screen.getByRole('checkbox', { name: 'Zero depreciation' }));

    expect(screen.getByText('₹12,430')).toBeTruthy();
    expect(screen.getByText(/was ₹12,250/)).toBeTruthy();
  });
});
