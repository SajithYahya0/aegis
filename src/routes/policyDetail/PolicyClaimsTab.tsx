import { useActionState, useEffect, useOptimistic, useRef, useState, type ReactElement } from 'react';
import { flushSync, useFormStatus } from 'react-dom';
import { useParams } from 'react-router-dom';
import { fetchClaimsForPolicy, submitClaim } from '../../shared/http';
import { Modal, type ModalHandle } from '../../shared/components/Modal';
import { SubmitButton } from '../../shared/components/SubmitButton';
import { TextField } from '../../shared/components/TextField';
import { Toast } from '../../shared/components/Toast';
import { CLAIM_STATUS_LABEL, formatCurrency, formatDate } from '../../shared/format';
import { useFetch } from '../../shared/hooks/useFetch';
import { isLabEnabled } from '../../shared/labs';
import type { Claim, ClaimType } from '../../shared/types';
import styles from './PolicyClaimsTab.module.css';

/** A claim not yet confirmed by the server — shown in the table as "Submitting…". */
interface PendingClaim extends Claim {
  pending?: true;
}

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

  const claims: readonly PendingClaim[] = [...(fetchedClaims ?? []), ...appended];

  /*
   * C-05. `optimisticClaims` is `claims` plus, for the moment between a submit
   * and the server settling, one extra entry `addOptimisticClaim` inserted.
   * React reverts to plain `claims` on its own once this render's underlying
   * state (`fetchedClaims` or `appended`) actually changes — there is no
   * explicit "remove the optimistic row" step anywhere below, on either the
   * success or the failure path. See this file's header for why that is the
   * point, not an omission.
   */
  const [optimisticClaims, addOptimisticClaim] = useOptimistic<readonly PendingClaim[], PendingClaim>(
    claims,
    (state, pendingClaim) => [...state, pendingClaim],
  );

  async function handleLogClaim(draft: { type: ClaimType; amount: number; description: string }): Promise<void> {
    modalRef.current?.close();

    addOptimisticClaim({
      id: `pending-${policyId}-${Date.now()}`,
      policyId,
      type: draft.type,
      amount: draft.amount,
      status: 'submitted',
      filedAt: new Date().toISOString().slice(0, 10),
      description: draft.description,
      pending: true,
    });

    try {
      const claim = await submitClaim(
        { policyId, ...draft },
        { forceFailure: isLabEnabled('claim-submit-failure') },
      );

      // See this file's header: without flushSync, `lastRowRef` would not yet
      // point at `claim`'s row when scrollIntoView runs on the next line.
      flushSync(() => {
        setAppended((prev) => [...prev, claim]);
      });
      lastRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setToastMessage(`Claim ${claim.id} logged.`);
    } catch (submitError) {
      // No `setAppended` here: `claims` never grows, so the optimistic entry
      // added above has nothing to reconcile into and React drops it once
      // this action's transition finishes — the rollback the header describes.
      setToastMessage(
        submitError instanceof Error
          ? `Claim submission failed: ${submitError.message}`
          : 'Claim submission failed.',
      );
    }
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <button type="button" onClick={() => modalRef.current?.open()}>
          Log claim
        </button>
      </div>

      {loading && optimisticClaims.length === 0 ? <p>Loading claims…</p> : null}
      {error ? <p role="alert">Could not load claims: {error.message}</p> : null}

      {!loading && optimisticClaims.length === 0 ? (
        <p>No claims filed against this policy.</p>
      ) : optimisticClaims.length > 0 ? (
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
            {optimisticClaims.map((claim, index) => (
              <tr
                key={claim.id}
                ref={index === optimisticClaims.length - 1 ? lastRowRef : undefined}
                className={
                  claim.pending
                    ? styles.pendingRow
                    : index >= (fetchedClaims?.length ?? 0)
                      ? styles.newRow
                      : undefined
                }
              >
                <td>{claim.id}</td>
                <td>{CLAIM_TYPE_LABEL[claim.type]}</td>
                <td>{formatCurrency(claim.amount)}</td>
                <td>{claim.pending ? 'Submitting…' : CLAIM_STATUS_LABEL[claim.status]}</td>
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

interface ClaimFormState {
  errors: { amount?: string; description?: string; submit?: string };
}

const INITIAL_CLAIM_FORM_STATE: ClaimFormState = { errors: {} };

/*
 * C-06/C-07, the second demonstration of the pattern `ClaimIntakeWizard`
 * builds — deliberately shaped differently. That wizard validates ahead of
 * time, per step, and closes over already-known-good values in its action;
 * this form is a single step, so the action reads straight from `FormData`
 * and returns real per-field errors, rendered through `TextField`'s existing
 * `error` prop rather than one general banner.
 */
function ClaimForm({ onSubmit, onCancel }: ClaimFormProps): ReactElement {
  const [type, setType] = useState<ClaimType>('other');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const [formState, formAction] = useActionState<ClaimFormState, FormData>(
    async (_previousState, formData) => {
      const amountValue = Number(formData.get('amount'));
      const descriptionValue = String(formData.get('description') ?? '').trim();

      const errors: ClaimFormState['errors'] = {};
      if (!formData.get('amount') || Number.isNaN(amountValue) || amountValue <= 0) {
        errors.amount = 'Enter a claim amount greater than zero.';
      }
      if (!descriptionValue) {
        errors.description = 'Describe the loss before submitting.';
      }
      if (Object.keys(errors).length > 0) return { errors };

      try {
        await onSubmit({ type, amount: amountValue, description: descriptionValue });
        return { errors: {} };
      } catch (submitError) {
        return {
          errors: {
            submit: submitError instanceof Error ? submitError.message : 'Could not submit the claim.',
          },
        };
      }
    },
    INITIAL_CLAIM_FORM_STATE,
  );

  return (
    <form className={styles.form} action={formAction}>
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
        name="amount"
        type="number"
        min={0}
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        error={formState.errors.amount}
      />

      <TextField
        label="Description"
        name="description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        error={formState.errors.description}
      />

      {formState.errors.submit ? (
        <p className={styles.formError} role="alert">
          {formState.errors.submit}
        </p>
      ) : null}

      <div className={styles.formActions}>
        <FormCancelButton onCancel={onCancel} />
        <SubmitButton label="Submit claim" pendingLabel="Submitting…" />
      </div>
    </form>
  );
}

/** Reads the same `useFormStatus()` as `SubmitButton` — see its header. */
function FormCancelButton({ onCancel }: { onCancel: () => void }): ReactElement {
  const { pending } = useFormStatus();
  return (
    <button type="button" onClick={onCancel} disabled={pending}>
      Cancel
    </button>
  );
}
