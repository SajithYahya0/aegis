/**
 * WHY THIS EXISTS:
 *   The claim intake wizard: three steps, per-step validation, and a review
 *   screen. It is the app's component-level code-split boundary — everything
 *   in this module (and its stylesheet, and the policy-lookup table it builds)
 *   lands in its own chunk that is not requested until the agent actually
 *   opens the intake modal on `/claims/new`.
 *
 *   This is the *default* export on purpose: `React.lazy` resolves
 *   `module.default` and nothing else, so a named export here would fail at
 *   runtime rather than at compile time.
 *
 * CONCEPTS: W3-D3-02
 *
 * WITHOUT THIS:
 *   Route-level splitting alone stops one route short. `/claims/new` is a page
 *   whose entire visible content is a paragraph and one button; the wizard is
 *   the heavy part — the step machine, the validation, the review formatting,
 *   the searchable policy index — and most visits to that route never open it.
 *   Bundled with the route, that weight is downloaded and parsed by every
 *   visitor to `/claims/new` including the ones who read the page and leave.
 *   Splitting at the *modal* instead of at the route moves the cost to the
 *   click that actually needs it.
 *
 *   That split only works because `Modal` returns `null` while closed. React
 *   does not load a lazy component because its element was *created* — the
 *   caller constructs `<ClaimIntakeWizard />` on every render of the page —
 *   it loads it when the element is *rendered*. A modal implemented as
 *   `<div hidden>` or `style={{display:'none'}}` around its children would
 *   render the lazy component immediately and download this chunk on page
 *   load, defeating the whole arrangement while still looking correct on
 *   screen. The unmount-when-closed behaviour is load-bearing here, not just
 *   tidy.
 *
 *   No `<Suspense>` at the call site in `ClaimIntakePage`: the wizard suspends
 *   the first time the modal opens, and with no boundary inside the modal the
 *   nearest one is the route boundary in `App.tsx` — so opening the dialog
 *   would blank the page behind it and then unmount the modal that was
 *   suspending, which unmounts the thing being waited for. The boundary goes
 *   inside the dialog.
 *
 *   Deliberately plain submission: this hands the finished draft to `onSubmit`
 *   and lets the caller do the write. The React 19 form hooks the submit path
 *   wants — `useActionState`, `useOptimistic`, `useFormStatus` (C-06, C-05,
 *   C-07) — belong to Phase 5 and are not faked here. A `useState`
 *   submitting-flag stands in until then, and is the thing Phase 5 deletes.
 */

import { useMemo, useState, type ReactElement } from 'react';
import { TextField } from '../../shared/components/TextField';
import { customersById, policies } from '../../shared/data';
import { formatCurrency } from '../../shared/format';
import type { ClaimType } from '../../shared/types';
import styles from './ClaimIntakeWizard.module.css';

const STEPS = ['Policy', 'Incident', 'Review'] as const;
type Step = (typeof STEPS)[number];

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

export interface ClaimIntakeDraft {
  policyId: string;
  type: ClaimType;
  amount: number;
  incidentDate: string;
  description: string;
}

export interface ClaimIntakeWizardProps {
  onSubmit: (draft: ClaimIntakeDraft) => Promise<void>;
  onCancel: () => void;
}

export default function ClaimIntakeWizard({
  onSubmit,
  onCancel,
}: ClaimIntakeWizardProps): ReactElement {
  const [step, setStep] = useState<Step>('Policy');
  const [policyQuery, setPolicyQuery] = useState('');
  const [policyId, setPolicyId] = useState('');
  const [type, setType] = useState<ClaimType>('accident');
  const [amount, setAmount] = useState('');
  const [incidentDate, setIncidentDate] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  /*
   * Part of what makes this chunk worth splitting: a searchable index over the
   * whole book, built once per query rather than per keystroke of any other
   * field. Only the first ten matches are offered — a 140-row datalist is not
   * a picker, it is a scroll.
   */
  const matches = useMemo(() => {
    const needle = policyQuery.trim().toLowerCase();
    if (!needle) return policies.slice(0, 10);
    return policies
      .filter((policy) => {
        const customerName = customersById.get(policy.customerId)?.name ?? '';
        return `${policy.id} ${customerName}`.toLowerCase().includes(needle);
      })
      .slice(0, 10);
  }, [policyQuery]);

  const selected = policyId ? policies.find((policy) => policy.id === policyId) : undefined;
  const parsedAmount = Number(amount);

  function goNext(): void {
    if (step === 'Policy') {
      if (!selected) {
        setError('Pick a policy from the list before continuing.');
        return;
      }
      setError(null);
      setStep('Incident');
      return;
    }

    if (step === 'Incident') {
      if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
        setError('Enter a claim amount greater than zero.');
        return;
      }
      if (selected && parsedAmount > selected.sumInsured) {
        setError(
          `Claimed amount exceeds the sum insured of ${formatCurrency(selected.sumInsured)}.`,
        );
        return;
      }
      if (!incidentDate) {
        setError('Enter the date of the incident.');
        return;
      }
      if (!description.trim()) {
        setError('Describe the loss before continuing.');
        return;
      }
      setError(null);
      setStep('Review');
    }
  }

  function goBack(): void {
    setError(null);
    if (step === 'Review') setStep('Incident');
    else if (step === 'Incident') setStep('Policy');
  }

  async function handleSubmit(): Promise<void> {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        policyId: selected.id,
        type,
        amount: parsedAmount,
        incidentDate,
        description: description.trim(),
      });
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : 'Could not submit the claim.');
      setSubmitting(false);
    }
  }

  const stepIndex = STEPS.indexOf(step);

  return (
    <div className={styles.wizard}>
      <h2 id="claim-intake-title">New claim</h2>

      <ol className={styles.steps}>
        {STEPS.map((label, index) => (
          <li
            key={label}
            className={
              index === stepIndex
                ? styles.stepActive
                : index < stepIndex
                  ? styles.stepDone
                  : styles.step
            }
          >
            {label}
          </li>
        ))}
      </ol>

      <div className={styles.body}>
        {step === 'Policy' ? (
          <>
            <TextField
              label="Find a policy"
              placeholder="Policy number or customer name"
              value={policyQuery}
              onChange={(event) => setPolicyQuery(event.target.value)}
            />
            <div className={styles.field}>
              <label htmlFor="claim-policy">Policy</label>
              <select
                id="claim-policy"
                value={policyId}
                onChange={(event) => setPolicyId(event.target.value)}
                size={6}
              >
                <option value="">— select —</option>
                {matches.map((policy) => (
                  <option key={policy.id} value={policy.id}>
                    {policy.id} · {customersById.get(policy.customerId)?.name ?? '—'} ·{' '}
                    {formatCurrency(policy.sumInsured)}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : null}

        {step === 'Incident' ? (
          <>
            <div className={styles.field}>
              <label htmlFor="claim-intake-type">Claim type</label>
              <select
                id="claim-intake-type"
                value={type}
                onChange={(event) => setType(event.target.value as ClaimType)}
              >
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
              label="Date of incident"
              type="date"
              value={incidentDate}
              onChange={(event) => setIncidentDate(event.target.value)}
            />
            <TextField
              label="What happened"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </>
        ) : null}

        {step === 'Review' && selected ? (
          <div className={styles.review}>
            <ReviewRow label="Policy" value={selected.id} />
            <ReviewRow
              label="Customer"
              value={customersById.get(selected.customerId)?.name ?? '—'}
            />
            <ReviewRow label="Sum insured" value={formatCurrency(selected.sumInsured)} />
            <ReviewRow label="Claim type" value={CLAIM_TYPE_LABEL[type]} />
            <ReviewRow label="Amount claimed" value={formatCurrency(parsedAmount)} />
            <ReviewRow label="Incident date" value={incidentDate} />
            <ReviewRow label="Description" value={description} />
          </div>
        ) : null}

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <div className={styles.actions}>
        <button type="button" onClick={step === 'Policy' ? onCancel : goBack} disabled={submitting}>
          {step === 'Policy' ? 'Cancel' : 'Back'}
        </button>
        {step === 'Review' ? (
          <button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit claim'}
          </button>
        ) : (
          <button type="button" onClick={goNext} disabled={submitting}>
            Continue
          </button>
        )}
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className={styles.reviewRow}>
      <span className={styles.reviewLabel}>{label}</span>
      <span className={styles.reviewValue}>{value}</span>
    </div>
  );
}
