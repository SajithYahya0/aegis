/**
 * WHY THIS EXISTS:
 *   A submit button that knows whether its own `<form>` is mid-action, without
 *   the form's owner having to pass a `pending` prop down to it. Read from
 *   `react-dom`'s `useFormStatus`, which resolves to the nearest ancestor
 *   `<form>` — so this component works unmodified inside `ClaimIntakeWizard`'s
 *   review step and inside `PolicyClaimsTab`'s quick claim form, two
 *   completely unrelated forms with two unrelated `useActionState` actions.
 *
 * CONCEPTS: C-07
 *
 * WITHOUT THIS:
 *   The alternative is threading a `pending`/`submitting` boolean down from
 *   whatever owns the `useActionState` call, as both forms did before this
 *   existed (`ClaimIntakeWizard`'s local `submitting` state, `PolicyClaimsTab`'s
 *   `ClaimForm`'s local `submitting` state). Every new form that wants a
 *   disabled-while-pending submit button then repeats the same prop, and a
 *   button reused across two forms — this one — cannot exist as a single
 *   component at all, because "pending" would mean something different
 *   depending on which parent's prop happened to be wired to it.
 *
 *   `useFormStatus` cannot be called by the component that renders the
 *   `<form>` itself — only by a descendant — which is why this has to be a
 *   separate component and not just a prop read inline at the call site.
 */

import { useFormStatus } from 'react-dom';
import type { ReactElement } from 'react';

export interface SubmitButtonProps {
  label: string;
  pendingLabel?: string;
}

export function SubmitButton({ label, pendingLabel }: SubmitButtonProps): ReactElement {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending}>
      {pending ? (pendingLabel ?? `${label}…`) : label}
    </button>
  );
}
