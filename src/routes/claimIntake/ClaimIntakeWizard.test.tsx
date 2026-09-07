import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { describe, expect, it, vi } from 'vitest';
import ClaimIntakeWizard from './ClaimIntakeWizard';
import { store } from '../../shared/store';

function renderWizard() {
  const onSubmitted = vi.fn();
  const onCancel = vi.fn();
  render(
    <Provider store={store}>
      <ClaimIntakeWizard onSubmitted={onSubmitted} onCancel={onCancel} />
    </Provider>,
  );
  return { onSubmitted, onCancel };
}

describe('ClaimIntakeWizard', () => {
  it('refuses to leave the Policy step without a policy, in the schema’s own words', async () => {
    renderWizard();

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // The message is `claimSchema`'s, not a string written in the component.
    // `findBy`, not `getBy`: `trigger()` returns a promise, so the error lands
    // a microtask after the click rather than during it.
    expect(
      await screen.findByText('Select the policy this claim is filed against.'),
    ).toBeInTheDocument();

    // Still on step one: the Incident step's fields are not in the DOM.
    expect(screen.queryByLabelText(/Amount claimed/)).not.toBeInTheDocument();
  });

  it('calls onCancel from the first step rather than navigating backwards', () => {
    const { onCancel } = renderWizard();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledOnce();
  });
});
