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
 *   The final submit is built on `useActionState`: the review step's "Submit
 *   claim" button lives inside a `<form action={submitAction}>`, and the
 *   action — not an `onClick` handler — owns the async call and the resulting
 *   error state. `WizardNavButton` and `SubmitButton` both read that form's
 *   pending flag via `useFormStatus` (C-07) instead of a `submitting` prop
 *   threaded down from here.
 *
 * CONCEPTS: W3-D3-02, C-06, C-07
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
 *   `useOptimistic` (C-05) deliberately does NOT live here, even though an
 *   earlier version of this header grouped all three React 19 form hooks
 *   together as "the submit path wants." `useOptimistic` needs a list to show
 *   a pending entry in before the server confirms, and this wizard has none —
 *   it is a modal that closes on success, not a table. `PolicyClaimsTab`'s
 *   "log claim" flow has a real claims table sitting right there, and that is
 *   where C-05 is built instead. Forcing all three hooks into this one file
 *   because an early comment grouped them would have meant inventing a list
 *   here nothing else in the wizard needs — the kind of contrived usage
 *   CLAUDE.md rules out.
 *
 *   The action still hands the finished draft to the caller-supplied
 *   `onSubmit` and lets it do the write — `submitClaim` itself lives in
 *   `api.ts`, not here.
 */

import { useActionState, useMemo, useState, type ReactElement, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { SubmitButton } from '../../shared/components/SubmitButton';
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
  // Step-transition validation only — see the header for why the *submit*
  // error lives in `submitState` instead, returned from the action below.
  const [stepError, setStepError] = useState<string | null>(null);

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
        setStepError('Pick a policy from the list before continuing.');
        return;
      }
      setStepError(null);
      setStep('Incident');
      return;
    }

    if (step === 'Incident') {
      if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
        setStepError('Enter a claim amount greater than zero.');
        return;
      }
      if (selected && parsedAmount > selected.sumInsured) {
        setStepError(
          `Claimed amount exceeds the sum insured of ${formatCurrency(selected.sumInsured)}.`,
        );
        return;
      }
      if (!incidentDate) {
        setStepError('Enter the date of the incident.');
        return;
      }
      if (!description.trim()) {
        setStepError('Describe the loss before continuing.');
        return;
      }
      setStepError(null);
      setStep('Review');
    }
  }

  function goBack(): void {
    setStepError(null);
    if (step === 'Review') setStep('Incident');
    else if (step === 'Incident') setStep('Policy');
  }

  /*
   * C-06: the review step's submit lives in this action, not an onClick
   * handler. By the time the agent can reach the Review step every field has
   * already passed `goNext`'s per-step validation, so the only failure this
   * action returns is the async one — the write itself rejecting. `formData`
   * goes unused deliberately: the values it would carry already live in this
   * closure as controlled state, and re-deriving them from FormData would be
   * a second, redundant source of truth for the same three fields.
   */
  const [submitState, submitAction] = useActionState<{ error: string | null }, FormData>(
    async (_previousState) => {
      if (!selected) return { error: 'Pick a policy from the list before continuing.' };
      try {
        await onSubmit({
          policyId: selected.id,
          type,
          amount: parsedAmount,
          incidentDate,
          description: description.trim(),
        });
        return { error: null };
      } catch (thrown) {
        return { error: thrown instanceof Error ? thrown.message : 'Could not submit the claim.' };
      }
    },
    { error: null },
  );

  const displayedError = stepError ?? submitState.error;
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

        {displayedError ? (
          <p className={styles.error} role="alert">
            {displayedError}
          </p>
        ) : null}
      </div>

      <form className={styles.actions} action={submitAction}>
        <WizardNavButton onClick={step === 'Policy' ? onCancel : goBack}>
          {step === 'Policy' ? 'Cancel' : 'Back'}
        </WizardNavButton>
        {step === 'Review' ? (
          <SubmitButton label="Submit claim" pendingLabel="Submitting…" />
        ) : (
          <WizardNavButton onClick={goNext}>Continue</WizardNavButton>
        )}
      </form>
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

/**
 * `type="button"` — Back/Cancel/Continue must never trigger the enclosing
 * `<form>`'s submit action, only the review step's `<SubmitButton>` should.
 * `disabled={pending}` comes from the same `useFormStatus()` read as
 * `SubmitButton`'s: both are descendants of the one `<form>` this wizard
 * renders, so both agree about "mid-submit" without either being told so by
 * a prop from `ClaimIntakeWizard`.
 */
function WizardNavButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}): ReactElement {
  const { pending } = useFormStatus();
  return (
    <button type="button" onClick={onClick} disabled={pending}>
      {children}
    </button>
  );
}
