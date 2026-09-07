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
