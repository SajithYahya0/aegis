/**
 * WHY THIS EXISTS:
 *   `/policies/:id/claims`. Loads this policy's claims through `useFetch` —
 *   the abortable, `useEffect`-driven path from `api.ts` (as opposed to the
 *   cached-promise `use()` path `PolicyCoverageTab` and friends read from
 *   synchronously) — and lets the agent log a new claim from a modal without
 *   leaving the tab.
 *
 * CONCEPTS: (fetch mechanics live in useFetch — see its header for
 *   W2-D1-01, W2-D1-02, W2-D1-03; the append flow below is C-10)
 *
 * WITHOUT THIS:
 *   `useFetch` would export a generic hook nothing in the app actually
 *   calls, and the fetch/abort/refetch story would only be provable by
 *   reading its source rather than by clicking between two policies' Claims
 *   tabs and watching the console.
 *
 *   No `flushSync` around the append: `setAppended` is a normal batched
 *   update, so `lastRowRef.current` is still `null` (or still pointing at
 *   the *previous* last row) at the moment `scrollIntoView` runs right after
 *   it — React has not re-rendered yet, because the browser has not been
 *   given a chance to and nothing has forced it to. The new row would exist
 *   in state but the scroll would target whatever was last in the DOM
 *   before it, which is one row short of where the agent actually needs to
 *   look. `flushSync` forces the DOM to catch up with `appended` synchronously,
 *   before the very next line runs.
 */

import { useEffect, useRef, useState, type FormEvent, type ReactElement } from 'react';
import { flushSync } from 'react-dom';
import { useParams } from 'react-router-dom';
import { fetchClaimsForPolicy, submitClaim } from '../../shared/api';
import { Modal, type ModalHandle } from '../../shared/components/Modal';
import { TextField } from '../../shared/components/TextField';
import { Toast } from '../../shared/components/Toast';
import { CLAIM_STATUS_LABEL, formatCurrency, formatDate } from '../../shared/format';
import { useFetch } from '../../shared/hooks/useFetch';
import type { Claim, ClaimType } from '../../shared/types';
import styles from './PolicyClaimsTab.module.css';

const CLAIM_TYPES: readonly ClaimType[] = [
  'accident',
  'theft',
  'fire',
  'flood',
  'hospitalisation',
  'criticalIllness',
  'death',
  'disability',
  'liability',
  'other',
];

const CLAIM_TYPE_LABEL: Record<ClaimType, string> = {
  accident: 'Accident',
  theft: 'Theft',
  fire: 'Fire',
  flood: 'Flood',
  hospitalisation: 'Hospitalisation',
  criticalIllness: 'Critical illness',
  death: 'Death',
  disability: 'Disability',
  liability: 'Liability',
  other: 'Other',
};

export default function PolicyClaimsTab(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const policyId = id ?? '';

  const { data: fetchedClaims, error, loading } = useFetch(
    (signal) => fetchClaimsForPolicy(policyId, signal),
    [policyId],
  );

  const [appended, setAppended] = useState<Claim[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const modalRef = useRef<ModalHandle>(null);
  const lastRowRef = useRef<HTMLTableRowElement>(null);

  // A different policy means a different claim history — claims logged
  // against POL-1 in this session have no business appearing under POL-2.
  useEffect(() => {
    setAppended([]);
  }, [policyId]);

  const claims = [...(fetchedClaims ?? []), ...appended];

  async function handleLogClaim(draft: { type: ClaimType; amount: number; description: string }): Promise<void> {
    const claim = await submitClaim({ policyId, ...draft });
    modalRef.current?.close();

    // See this file's header: without flushSync, `lastRowRef` would not yet
    // point at `claim`'s row when scrollIntoView runs on the next line.
    flushSync(() => {
      setAppended((prev) => [...prev, claim]);
    });
    lastRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setToastMessage(`Claim ${claim.id} logged.`);
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <button type="button" onClick={() => modalRef.current?.open()}>
          Log claim
        </button>
      </div>

      {loading && claims.length === 0 ? <p>Loading claims…</p> : null}
      {error ? <p role="alert">Could not load claims: {error.message}</p> : null}

      {!loading && claims.length === 0 ? (
        <p>No claims filed against this policy.</p>
      ) : claims.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Claim</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Filed</th>
            </tr>
          </thead>
          <tbody>
            {claims.map((claim, index) => (
              <tr
                key={claim.id}
                ref={index === claims.length - 1 ? lastRowRef : undefined}
                className={index >= (fetchedClaims?.length ?? 0) ? styles.newRow : undefined}
              >
                <td>{claim.id}</td>
                <td>{CLAIM_TYPE_LABEL[claim.type]}</td>
                <td>{formatCurrency(claim.amount)}</td>
                <td>{CLAIM_STATUS_LABEL[claim.status]}</td>
                <td>{formatDate(claim.filedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      <Modal ref={modalRef} labelledBy="log-claim-title">
        <ClaimForm onSubmit={handleLogClaim} onCancel={() => modalRef.current?.close()} />
      </Modal>

      {toastMessage ? <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} /> : null}
    </div>
  );
}

interface ClaimFormProps {
  onSubmit: (draft: { type: ClaimType; amount: number; description: string }) => Promise<void>;
  onCancel: () => void;
}

function ClaimForm({ onSubmit, onCancel }: ClaimFormProps): ReactElement {
  const [type, setType] = useState<ClaimType>('other');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError('Enter a claim amount greater than zero.');
      return;
    }
    if (!description.trim()) {
      setFormError('Describe the loss before submitting.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      await onSubmit({ type, amount: parsedAmount, description: description.trim() });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not submit the claim.');
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h2 id="log-claim-title">Log claim</h2>

      <div>
        <label htmlFor="claim-type">Claim type</label>
        <select id="claim-type" value={type} onChange={(event) => setType(event.target.value as ClaimType)}>
          {CLAIM_TYPES.map((claimType) => (
            <option key={claimType} value={claimType}>
              {CLAIM_TYPE_LABEL[claimType]}
            </option>
          ))}
        </select>
      </div>

      <TextField
        label="Amount claimed (₹)"
        type="number"
        min={0}
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
      />

      <TextField
        label="Description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />

      {formError ? (
        <p className={styles.formError} role="alert">
          {formError}
        </p>
      ) : null}

      <div className={styles.formActions}>
        <button type="button" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit claim'}
        </button>
      </div>
    </form>
  );
}
