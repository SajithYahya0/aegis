/**
 * WHY THIS EXISTS:
 *   `claimSchema.test.ts` proves the rules are right. This proves the *gate* is
 *   wired to them — that `trigger(STEP_FIELDS[step])` runs on Continue, that a
 *   failure keeps the wizard on its current step, and that the message the
 *   agent sees is the schema's own words rather than one written in the
 *   component.
 *
 *   Those are two genuinely different failures. A correct schema behind a step
 *   button that never calls it produces a wizard that validates nothing until
 *   the final submit and then reports errors for fields three screens back —
 *   and every assertion in `claimSchema.test.ts` still passes.
 *
 * CONCEPTS: W4-D5-01, W4-D5-03, W3-D2-07
 *
 * WITHOUT THIS:
 *   The per-step gate is asserted by nothing. `App.test.tsx` deliberately
 *   checks that this component is *absent* — it is the closed half of the
 *   code-split proof — so before this file the wizard's own behaviour had no
 *   test at all, and the only thing standing between a broken step machine and
 *   a release was somebody opening the dialog by hand.
 *
 *   `fireEvent` rather than `@testing-library/user-event`: the second is not in
 *   `CLAUDE.md`'s pinned dependency list, and what is being asserted here is
 *   what happens after a click lands — not how faithfully the click was
 *   simulated. Where that distinction would matter (hovering to preload a
 *   chunk, typing into a debounced box) this repo already uses `fireEvent` too;
 *   see `lazyRoutes.test.tsx`.
 */

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
