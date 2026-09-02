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
 *
 *   No `required` on the mandatory fields: `goNext()` has always refused to
 *   leave the Incident step without an amount, a date and a description, but
 *   the form gave no advance warning that any of them mattered. The failure
 *   is not that invalid data got through — it did not — it is the shape of
 *   the correction: one error at a time, discovered only on Continue, so an
 *   agent who left three fields blank makes three round trips to find that
 *   out. The `*` markers and `aria-required` state the contract up front;
 *   `goNext()` still enforces it, because a marker is a hint and the
 *   validator is the rule.
 *
 *   No location or claimant contact: a first notice of loss that records an
 *   amount and a sentence but no incident location and no way to reach the
 *   claimant is not a claim anyone downstream can act on — the assessor has
 *   nowhere to visit and no one to call. The FIR number and third-party flag
 *   are optional because they genuinely are: a household water-damage claim
 *   has neither, and making them mandatory would force agents to type
 *   "N/A" into a field the recovery team later has to read as data.
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
  incidentLocation: string;
  description: string;
  claimantPhone: string;
  /** Optional — see this file's header for why these four are not enforced. */
  claimantEmail: string;
  policeReportNumber: string;
  thirdPartyInvolved: boolean;
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
  const [incidentLocation, setIncidentLocation] = useState('');
  const [description, setDescription] = useState('');
  const [claimantPhone, setClaimantPhone] = useState('');
  const [claimantEmail, setClaimantEmail] = useState('');
  const [policeReportNumber, setPoliceReportNumber] = useState('');
  const [thirdPartyInvolved, setThirdPartyInvolved] = useState(false);
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
      // Checked in the order the fields are laid out, so the message always
      // names the topmost blank one rather than whichever branch happens to
      // come first in this function.
      if (!incidentLocation.trim()) {
        setStepError('Enter where the incident took place.');
        return;
      }
      if (!description.trim()) {
        setStepError('Describe the loss before continuing.');
        return;
      }
      if (!claimantPhone.trim()) {
        setStepError('Enter a phone number for the claimant.');
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
   * a second, redundant source of truth for every field on the draft.
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
          incidentLocation: incidentLocation.trim(),
          description: description.trim(),
          claimantPhone: claimantPhone.trim(),
          claimantEmail: claimantEmail.trim(),
          policeReportNumber: policeReportNumber.trim(),
          thirdPartyInvolved,
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
              <label htmlFor="claim-policy">
                Policy
                <span className={styles.required} aria-hidden="true">
                  {' *'}
                </span>
              </label>
              <select
                id="claim-policy"
                value={policyId}
                onChange={(event) => setPolicyId(event.target.value)}
                required
                aria-required="true"
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
            {/*
              Paired onto one line so the Incident step still fits a single
              screen after the claimant fields below were added — `.row`
              collapses back to one column under 480px.
            */}
            <div className={styles.row}>
              <TextField
                label="Amount claimed (₹)"
                type="number"
                min={0}
                required
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              <TextField
                label="Date of incident"
                type="date"
                required
                value={incidentDate}
                onChange={(event) => setIncidentDate(event.target.value)}
              />
            </div>
            <TextField
              label="Incident location"
              placeholder="Street, city — where the loss occurred"
              required
              value={incidentLocation}
              onChange={(event) => setIncidentLocation(event.target.value)}
            />
            <TextField
              label="What happened"
              required
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <div className={styles.row}>
              <TextField
                label="Claimant phone"
                type="tel"
                required
                value={claimantPhone}
                onChange={(event) => setClaimantPhone(event.target.value)}
              />
              <TextField
                label="Claimant email"
                type="email"
                value={claimantEmail}
                onChange={(event) => setClaimantEmail(event.target.value)}
              />
            </div>
            <TextField
              label="Police report / FIR number"
              placeholder="If one was filed"
              value={policeReportNumber}
              onChange={(event) => setPoliceReportNumber(event.target.value)}
            />
            {/*
              A checkbox, so `checked`/`onChange` rather than `value` — and
              therefore not a `TextField`, which is built around a text
              input's value contract.
            */}
            <label className={styles.checkboxField}>
              <input
                type="checkbox"
                checked={thirdPartyInvolved}
                onChange={(event) => setThirdPartyInvolved(event.target.checked)}
              />
              Third party involved
            </label>
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
            <ReviewRow label="Incident location" value={incidentLocation} />
            <ReviewRow label="Description" value={description} />
            <ReviewRow label="Claimant phone" value={claimantPhone} />
            {/* Em dash rather than an empty cell: "not supplied" and "the row
                failed to render" should not look the same on a review screen. */}
            <ReviewRow label="Claimant email" value={claimantEmail || '—'} />
            <ReviewRow label="Police report / FIR" value={policeReportNumber || '—'} />
            <ReviewRow label="Third party involved" value={thirdPartyInvolved ? 'Yes' : 'No'} />
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
