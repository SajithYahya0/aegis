/**
 * WHY THIS EXISTS:
 *   A labelled input whose `id` comes from `useId()` instead of a
 *   hand-written string, so every instance gets its own — this is what makes
 *   it safe to render several in a loop, which is exactly how the quote
 *   wizard's insured-party fieldset uses it.
 *
 * CONCEPTS: C-01
 *
 * WITHOUT THIS:
 *   The insured-party fieldset in `QuoteWizardPage` renders one row per
 *   `InsuredParty`, and a wizard commonly has two or three (self, spouse, a
 *   child). A hard-coded `id="fullName"` on that row's input, repeated once
 *   per party, means the DOM has three inputs sharing one id and three
 *   labels all pointing `htmlFor="fullName"` at the *first* one only —
 *   clicking the third party's "Full name" label focuses the first party's
 *   input instead, and a screen reader announces every one of them as just
 *   "Full name" with no way to tell which insured person it belongs to.
 *   `useId()` generates a fresh, collision-free id per rendered instance, so
 *   the label/input/error association stays correct no matter how many
 *   copies of this field are on the page at once.
 *
 *   No `required` prop: `ClaimIntakeWizard`'s `goNext()` already refuses to
 *   advance past the Incident step without an amount, a date, a location, a
 *   phone number and a description — but nothing on screen said so. An agent
 *   filled in what looked optional, pressed Continue, and was told after the
 *   fact which field they had missed, one field per attempt. Marking the
 *   fields the validator actually enforces turns that into information the
 *   user has *before* they submit. The marker is deliberately two signals,
 *   not one: a red `*` carrying `aria-hidden` for sighted users, and
 *   `required` + `aria-required` on the input itself for assistive tech —
 *   a screen reader announces "required", it does not read out punctuation
 *   glued to a label.
 */

import { useId, type InputHTMLAttributes, type ReactElement } from 'react';
import styles from './TextField.module.css';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  error?: string;
  /**
   * Marks the field as mandatory: renders a `*` after the label and sets
   * `required` / `aria-required` on the input. Redeclared here rather than
   * inherited silently from `InputHTMLAttributes` because this component
   * does something visible with it, and a caller reading the props should
   * see that.
   */
  required?: boolean;
}

export function TextField({ label, error, required, ...inputProps }: TextFieldProps): ReactElement {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className={styles.field}>
      <label htmlFor={id}>
        {label}
        {required ? (
          <span className={styles.required} aria-hidden="true">
            {' *'}
          </span>
        ) : null}
      </label>
      <input
        id={id}
        required={required}
        aria-required={required ? true : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      {error ? (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
