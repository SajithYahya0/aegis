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
