/**
 * WHY THIS EXISTS:
 *   `/policies/:id/claims`. Loads this policy's claims through `useFetch` —
 *   the abortable, `useEffect`-driven path from `api.ts` (as opposed to the
 *   cached-promise `use()` path `PolicyCoverageTab` and friends read from
 *   synchronously) — and lets the agent log a new claim from a modal without
 *   leaving the tab.
 *
 *   It is also where the optimistic claim submission lives (C-05): the modal
 *   closes the instant the agent submits, and the new claim appears in the
 *   table below labelled "Submitting…" before `submitClaim`'s simulated
 *   400–900ms round trip has even resolved. `useOptimistic` wraps `claims`
 *   (the real, confirmed list) rather than `appended` alone, so the optimistic
 *   row sits in the same array, at the same position, as the row it becomes on
 *   success — or silently reverts to if the write fails. This is the flow
 *   `ClaimIntakeWizard` deliberately does NOT build the same hook into — see
 *   that file's header — because this tab has the one thing an optimistic
 *   update needs and the wizard does not: a list already on screen to show it
 *   in.
 *
 * CONCEPTS: (fetch mechanics live in useFetch — see its header for
 *   W2-D1-01, W2-D1-02, W2-D1-03; the append flow below is C-10; the claim
 *   form's own submit is C-06/C-07, same pattern as ClaimIntakeWizard but
 *   with real per-field errors read from FormData instead of closed-over
 *   state; the optimistic list is C-05)
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
 *
 *   No `useOptimistic`: the modal would have to stay open (or the agent would
 *   stare at an empty gap in the table) for the full simulated round trip
 *   before the claim they just described appears anywhere. Nothing on screen
 *   would distinguish "the click registered and is in flight" from "the click
 *   did nothing" for up to 900ms — long enough that a real agent's instinct is
 *   to click "Log claim" a second time.
 *
 *   No rollback path: forcing `submitClaim` to fail (the `claim-submit-failure`
 *   lab toggle) with only a plain `appended` array would leave the optimistic
 *   row's fate entirely manual — some extra bookkeeping to remove exactly the
 *   one row that failed, out of however many are mid-flight at once.
 *   `useOptimistic` needs none of that: the optimistic overlay is derived from
 *   `claims`, and `claims` only grows when `setAppended` actually runs. A
 *   failed write never calls it, so the row it would have added simply is
 *   not there once React reverts to the real state — there is no removal step
 *   to get wrong.
 */

import { useActionState, useEffect, useOptimistic, useRef, useState, type ReactElement } from 'react';
import { flushSync, useFormStatus } from 'react-dom';
import { useParams } from 'react-router-dom';
import { fetchClaimsForPolicy, submitClaim } from '../../shared/api';
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
