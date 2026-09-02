/**
 * WHY THIS EXISTS:
 *   The `/quote` route: four steps (applicant, risk, coverage, review) driven
 *   entirely by `QuoteContext`'s reducer. Every field here is controlled —
 *   its value comes from the `state` half of `useQuote()` and every change
 *   goes through the `dispatch` half — so the draft in `state` is always
 *   what is on screen, and it is what gets written to `localStorage` on
 *   every change.
 *
 *   It also carries the wizard's live "indicative premium": a rough,
 *   pre-bind estimate shown in the sticky summary bar (`StickyPremiumSummary`)
 *   as the agent edits sum insured, term, coverage and declared prior claims.
 *   This is deliberately a cheap manual-rate formula, not `rating.ts`'s
 *   `ratePolicy` — a real insurer's quote-time indicative figure and its
 *   bound-policy actuarial price are genuinely different numbers computed by
 *   different code, and pretending otherwise here would misrepresent that
 *   `ratePolicy` needs a real `Policy`/`Customer`/claims history the wizard
 *   does not have yet.
 *
 *   `WizardNav` will not advance a step whose required fields are blank —
 *   the same per-step gate `ClaimIntakeWizard.goNext()` applies, built the
 *   same way and worded in the same tone. See `validateStep` below for which
 *   fields are enforced on which step, and why the Coverage step enforces
 *   nothing.
 *
 * CONCEPTS: W2-D3-04, W2-D1-07, C-01
 *
 * WITHOUT THIS:
 *   `QuoteContext` would export a reducer and a hook that nothing in the
 *   app actually calls — a context "consumed across wizard steps" (the
 *   matrix's own phrase for W2-D3-04) requires steps that consume it. Without
 *   a route exercising `dispatch`, the mutating-reducer lab defect
 *   (W2-D3-02) would also have no real action to attach to; it would have to
 *   move into a synthetic demo the way the rules-of-hooks violation did,
 *   which the lab registry deliberately avoids for this one defect because a
 *   contrived reducer only proves the *shape* of the bug, not that it
 *   surfaces through real usage.
 *
 *   `estimateIndicativePremium` is called directly in the render body below
 *   — not stashed in a `useState` that an effect keeps in sync. The tempting
 *   alternative, `const [premium, setPremium] = useState(0); useEffect(() =>
 *   setPremium(estimateIndicativePremium(state)), [state])`, renders every
 *   change to `state` *twice*: once with the stale premium from before the
 *   edit (the effect has not run yet), then again once it has. On a page
 *   whose whole point is a live-updating premium, that is a visible one-frame
 *   lag on every keystroke, for a value that costs nothing to compute
 *   up front — there is no expensive work here to defer the way `useMemo`
 *   defers `rateBook` (W3-D1-03). An effect exists to synchronise with
 *   something *outside* React (storage, a subscription, the DOM); a value
 *   derivable purely from props and state belongs in the render itself.
 *
 *   No `useId` on the insured-party fields: see `TextField`'s header for the
 *   label-collision bug a hard-coded id would reintroduce in this exact
 *   fieldset.
 *
 *   No step validation: `Next` dispatched `NEXT_STEP` unconditionally, so
 *   every step advanced with empty fields and the wizard reached the Review
 *   screen showing "—, —", zero insured parties and a premium quoted off a
 *   sum insured of nothing. There is no submit here to catch that later: the
 *   draft is written to `localStorage` on every dispatch, so a blank quote is
 *   *saved*, not merely displayed, and the agent who reloads gets it back.
 *   The gate has to sit on the step transition.
 */

import { useState, type ReactElement } from 'react';
import { BASE_RATE_PER_MILLE, CATALOGUE } from '../shared/data';
import { formatCurrency, POLICY_TYPE_LABEL } from '../shared/format';
import { TextField } from '../shared/components/TextField';
import { QUOTE_STEP_ORDER, useQuote } from '../shared/store/QuoteContext';
import type { PolicyType, Quote, QuoteStep } from '../shared/types';
import { StickyPremiumSummary } from './quoteWizard/StickyPremiumSummary';
import styles from './QuoteWizardPage.module.css';

/**
 * A rough manual-rate estimate: base rate × sum insured, scaled for term,
 * nudged up for declared prior claims and for each optional coverage the
 * applicant has opted into. Not the actuarial engine — see this file's
 * header for why that distinction is deliberate.
 */
function estimateIndicativePremium(quote: Quote): number {
  const base = (BASE_RATE_PER_MILLE[quote.type] * quote.sumInsured) / 1000;
  const termAdjusted = base * (quote.termMonths / 12);
  const claimsLoaded = termAdjusted * (1 + quote.priorClaims * 0.08);
  const coverageLoaded = claimsLoaded * (1 + quote.selectedCoverageCodes.length * 0.015);
  return Math.round(coverageLoaded / 10) * 10;
}

/**
 * The gate `WizardNav` applies before dispatching `NEXT_STEP`. Returns the
 * message to show, or `null` to let the step advance.
 *
 * Fields are checked in the order they are laid out, so the message always
 * names the topmost blank one rather than whichever branch happens to come
 * first here — the same rule `ClaimIntakeWizard.goNext()` follows, and the
 * reason an agent who left three fields blank is walked down the form
 * instead of around it.
 *
 * What is enforced, and why:
 *
 * - **Applicant.** `city` and `state` place the risk; `fullName` and
 *   `dateOfBirth` identify who is covered, and the date of birth is what
 *   `rating.ts`'s `ageLoading` reads when the quote is eventually bound — a
 *   quote carried forward without it cannot be priced by the real engine at
 *   all. At least one insured party must exist, because `createBlankQuote()`
 *   starts with an empty array: the untouched wizard is in exactly that
 *   state, and a policy insuring nobody is not a quote.
 *
 * - **Risk.** `sumInsured` and `priorClaims` are both read by
 *   `estimateIndicativePremium` above. A sum insured of zero is reachable —
 *   clearing the number input coerces the empty string to 0 — and prices the
 *   whole quote at nothing. `priorClaims` cannot be blanked for that same
 *   reason, so what it needs guarding against is not emptiness but a
 *   negative count, which `min={0}` does not enforce outside a native form
 *   submit and which would turn the claims *loading* into a discount for
 *   having had claims.
 *
 * - **Coverage: nothing, deliberately.** The only value that step edits is
 *   `selectedCoverageCodes`, and an empty selection is a real answer rather
 *   than a blank field — every policy type in `CATALOGUE` carries at least
 *   one `mandatory: true` coverage, always in force and already priced by
 *   the base rate. Requiring an optional rider would be a business rule
 *   invented to give the step something to validate. It is left honest, and
 *   no control on that step carries a `*`.
 *
 * The two `<select>`s the premium reads — policy type and term — are not
 * checked and carry no marker, because neither can be empty: both are
 * controlled selects over a closed option list with a default from
 * `createBlankQuote()`. A `required` on a control that cannot be blank
 * advertises a rule that does not exist.
 */
function validateStep(quote: Quote): string | null {
  if (quote.step === 'applicant') {
    if (!quote.city.trim()) return 'Enter the city where the risk is located.';
    if (!quote.state.trim()) return 'Enter the state where the risk is located.';
    if (quote.insured.length === 0) return 'Add at least one insured party before continuing.';
    for (let i = 0; i < quote.insured.length; i++) {
      const party = quote.insured[i]!;
      if (!party.fullName.trim()) return `Enter a full name for insured party ${i + 1}.`;
      if (!party.dateOfBirth) return `Enter a date of birth for insured party ${i + 1}.`;
    }
    return null;
  }

  if (quote.step === 'risk') {
    if (!Number.isFinite(quote.sumInsured) || quote.sumInsured <= 0) {
      return 'Enter a sum insured greater than zero.';
    }
    if (!Number.isFinite(quote.priorClaims) || quote.priorClaims < 0) {
      return 'Prior claims cannot be a negative number.';
    }
    return null;
  }

  return null;
}

const STEP_LABEL: Record<QuoteStep, string> = {
  applicant: 'Applicant',
  risk: 'Risk',
  coverage: 'Coverage',
  review: 'Review',
};

const POLICY_TYPES: readonly PolicyType[] = ['motor', 'health', 'property', 'life'];
const TERM_OPTIONS = [6, 12, 24, 36] as const;

export default function QuoteWizardPage(): ReactElement {
  const [state] = useQuote();

  return (
    <div className={styles.wizard}>
      <div className={styles.wizardHeader}>
        <h1>New quote</h1>

        <ol className={styles.steps}>
          {QUOTE_STEP_ORDER.map((step) => (
            <li key={step} className={step === state.step ? styles.stepActive : styles.step}>
              {STEP_LABEL[step]}
            </li>
          ))}
        </ol>
      </div>

      <StickyPremiumSummary premium={estimateIndicativePremium(state)} />

      {state.step === 'applicant' ? <ApplicantStep /> : null}
      {state.step === 'risk' ? <RiskStep /> : null}
      {state.step === 'coverage' ? <CoverageStep /> : null}
      {state.step === 'review' ? <ReviewStep /> : null}

      <WizardNav />
    </div>
  );
}

function WizardNav(): ReactElement {
  const [state, dispatch] = useQuote();
  // Step-transition validation only, and local to the nav that triggers it:
  // no other component needs to know that a step was refused, so it does not
  // belong in the reducer beside the draft, which is shared *and* persisted.
  // A rejected Next must not write anything to localStorage.
  const [stepError, setStepError] = useState<string | null>(null);
  const index = QUOTE_STEP_ORDER.indexOf(state.step);

  function goNext(): void {
    const error = validateStep(state);
    if (error) {
      setStepError(error);
      return;
    }
    setStepError(null);
    dispatch({ type: 'NEXT_STEP' });
  }

  function goBack(): void {
    // Cleared on the way back as well: the message names a field on the step
    // being left, so keeping it on screen would accuse the previous step of
    // a fault that is not on it.
    setStepError(null);
    dispatch({ type: 'PREV_STEP' });
  }

  return (
    <>
      {stepError ? (
        <p className={styles.error} role="alert">
          {stepError}
        </p>
      ) : null}

      <div className={styles.actions}>
        <button type="button" disabled={index === 0} onClick={goBack}>
          Back
        </button>
        <button type="button" disabled={index === QUOTE_STEP_ORDER.length - 1} onClick={goNext}>
          Next
        </button>
      </div>
    </>
  );
}

function ApplicantStep(): ReactElement {
  const [state, dispatch] = useQuote();

  return (
    <section className={styles.stepBody}>
      {/* No marker: `type` is a closed option list with a default, so there
          is no emptiness to enforce — see `validateStep`. */}
      <div className={styles.field}>
        <label htmlFor="quote-type">Policy type</label>
        <select
          id="quote-type"
          value={state.type}
          onChange={(event) => dispatch({ type: 'SET_TYPE', policyType: event.target.value as PolicyType })}
        >
          {POLICY_TYPES.map((type) => (
            <option key={type} value={type}>
              {POLICY_TYPE_LABEL[type]}
            </option>
          ))}
        </select>
      </div>

      {/* City and State moved off their hand-rolled label+input pairs and
          onto TextField to pick up its `required` marker: the `*`, the
          `required` attribute and `aria-required` are one implementation
          there rather than a third copy of them here. The hard-coded ids
          went with the move — nothing referenced them, and useId() is what
          keeps the label pointing at the right input anyway. */}
      <TextField
        label="City"
        required
        value={state.city}
        onChange={(event) =>
          dispatch({ type: 'SET_LOCATION', city: event.target.value, state: state.state })
        }
      />

      <TextField
        label="State"
        required
        value={state.state}
        onChange={(event) =>
          dispatch({ type: 'SET_LOCATION', city: state.city, state: event.target.value })
        }
      />

      <h3>Insured parties</h3>
      {state.insured.map((party) => (
        <div key={party.key} className={styles.insuredRow}>
          {/* Each iteration mounts its own <TextField>, so each gets its own
              useId()-generated id — three parties on screen at once means
              three distinct label/input pairs, not one id shared by three
              inputs. See TextField's header. */}
          <TextField
            label="Full name"
            required
            value={party.fullName}
            onChange={(event) =>
              dispatch({ type: 'UPDATE_INSURED', key: party.key, patch: { fullName: event.target.value } })
            }
          />
          <TextField
            label="Date of birth"
            type="date"
            required
            value={party.dateOfBirth}
            onChange={(event) =>
              dispatch({
                type: 'UPDATE_INSURED',
                key: party.key,
                patch: { dateOfBirth: event.target.value },
              })
            }
          />
          {/* No marker: `relationship` is defaulted by the reducer on every
              ADD_INSURED and is a closed option list, so it is never blank. */}
          <select
            value={party.relationship}
            onChange={(event) =>
              dispatch({
                type: 'UPDATE_INSURED',
                key: party.key,
                patch: { relationship: event.target.value as typeof party.relationship },
              })
            }
          >
            <option value="self">Self</option>
            <option value="spouse">Spouse</option>
            <option value="child">Child</option>
            <option value="parent">Parent</option>
            <option value="other">Other</option>
          </select>
          <button type="button" onClick={() => dispatch({ type: 'REMOVE_INSURED', key: party.key })}>
            Remove
          </button>
        </div>
      ))}
      <button type="button" onClick={() => dispatch({ type: 'ADD_INSURED' })}>
        Add insured party
      </button>
    </section>
  );
}

function RiskStep(): ReactElement {
  const [state, dispatch] = useQuote();

  return (
    <section className={styles.stepBody}>
      <TextField
        label="Sum insured"
        type="number"
        min={0}
        step={10_000}
        required
        value={state.sumInsured}
        onChange={(event) => dispatch({ type: 'SET_SUM_INSURED', sumInsured: Number(event.target.value) })}
      />

      {/* Stays a raw <select>: TextField is built around an <input> and its
          props are typed as one, so the term picker cannot move across
          without turning that component into a generic control. It would
          carry no marker either way — a closed option list with a default
          has no emptiness to enforce. */}
      <div className={styles.field}>
        <label htmlFor="quote-term">Term</label>
        <select
          id="quote-term"
          value={state.termMonths}
          onChange={(event) => dispatch({ type: 'SET_TERM_MONTHS', termMonths: Number(event.target.value) })}
        >
          {TERM_OPTIONS.map((months) => (
            <option key={months} value={months}>
              {months} months
            </option>
          ))}
        </select>
      </div>

      {/* Marked required because the premium reads it and it must carry a
          number — zero being a perfectly good answer. What `validateStep`
          actually guards is the one bad value this control can still produce
          on its own: a negative count. */}
      <TextField
        label="Prior claims (last 3 years)"
        type="number"
        min={0}
        required
        value={state.priorClaims}
        onChange={(event) => dispatch({ type: 'SET_PRIOR_CLAIMS', count: Number(event.target.value) })}
      />
    </section>
  );
}

function CoverageStep(): ReactElement {
  const [state, dispatch] = useQuote();
  const entries = CATALOGUE[state.type];

  return (
    <section className={styles.stepBody}>
      {entries.map((entry) => {
        const checked = entry.mandatory || state.selectedCoverageCodes.includes(entry.code);
        return (
          <div key={entry.code} className={styles.field}>
            <label>
              <input
                type="checkbox"
                checked={checked}
                disabled={entry.mandatory}
                onChange={() => dispatch({ type: 'TOGGLE_COVERAGE', code: entry.code })}
              />{' '}
              {entry.label} {entry.mandatory ? '(mandatory)' : ''}
            </label>
          </div>
        );
      })}
    </section>
  );
}

function ReviewStep(): ReactElement {
  const [state, dispatch] = useQuote();

  return (
    <section className={styles.stepBody}>
      <dl>
        <dt>Type</dt>
        <dd>{POLICY_TYPE_LABEL[state.type]}</dd>
        <dt>Location</dt>
        <dd>
          {state.city || '—'}, {state.state || '—'}
        </dd>
        <dt>Sum insured</dt>
        <dd>{formatCurrency(state.sumInsured)}</dd>
        <dt>Term</dt>
        <dd>{state.termMonths} months</dd>
        <dt>Insured parties</dt>
        <dd>{state.insured.length}</dd>
        <dt>Coverages selected</dt>
        <dd>{state.selectedCoverageCodes.length}</dd>
        <dt>Prior claims</dt>
        <dd>{state.priorClaims}</dd>
      </dl>
      <button type="button" onClick={() => dispatch({ type: 'RESET' })}>
        Start over
      </button>
    </section>
  );
}
