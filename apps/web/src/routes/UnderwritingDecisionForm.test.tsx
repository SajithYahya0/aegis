import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { policies } from '../shared/data';
import { http } from '../shared/http/client';
import { installInterceptors } from '../shared/http/interceptors';
import { installMockBackend } from '../shared/http/mockBackend';
import { store } from '../shared/store';
import { UnderwritingDecisionForm } from './UnderwritingDecisionForm';

installMockBackend(http);
installInterceptors(store);

const QUEUE = policies.slice(0, 2);
const REASONING = 'Warehouse loft rewired after the fire; accept with a small loading.';

type User = ReturnType<typeof userEvent.setup>;

async function fillDecision(user: User, loading: string): Promise<void> {
  await user.click(screen.getByRole('combobox', { name: /Policy/ }));
  await user.click(await screen.findByRole('option', { name: new RegExp(QUEUE[0].id) }));
  await user.clear(screen.getByLabelText(/Rate loading/));
  await user.type(screen.getByLabelText(/Rate loading/), loading);
  await user.type(screen.getByLabelText(/Underwriting note/), REASONING);
}

describe('UnderwritingDecisionForm', () => {
  it('refuses a loading above the underwriter own authority', async () => {
    const user = userEvent.setup();
    const onRecorded = vi.fn();
    render(<UnderwritingDecisionForm queue={QUEUE} maxLoadingPct={40} onRecorded={onRecorded} />);

    await fillDecision(user, '60');
    await user.click(screen.getByRole('button', { name: 'Record decision' }));

    expect(
      await screen.findByText('40% is the most you may load on your own authority.'),
    ).toBeTruthy();
    expect(onRecorded).not.toHaveBeenCalled();
  });

  it('records a decision the server accepts and clears the form for the next referral', async () => {
    const user = userEvent.setup();
    const onRecorded = vi.fn();
    render(<UnderwritingDecisionForm queue={QUEUE} maxLoadingPct={40} onRecorded={onRecorded} />);

    await fillDecision(user, '15');
    await user.click(screen.getByRole('button', { name: 'Record decision' }));

    await waitFor(() => expect(onRecorded).toHaveBeenCalledTimes(1));
    expect(onRecorded.mock.calls[0][0]).toMatchObject({ policyId: QUEUE[0].id, loadingPct: 15 });
    expect(screen.getByLabelText(/Underwriting note/)).toHaveProperty('value', '');
  });
});
