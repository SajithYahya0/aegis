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
 */

import { useRef, type ReactElement } from 'react';
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
  const headerRef = useRef<HTMLDivElement>(null);

  return (
    <div className={styles.wizard}>
      <div ref={headerRef} className={styles.wizardHeader}>
        <h1>New quote</h1>

        <ol className={styles.steps}>
          {QUOTE_STEP_ORDER.map((step) => (
            <li key={step} className={step === state.step ? styles.stepActive : styles.step}>
              {STEP_LABEL[step]}
            </li>
          ))}
        </ol>
      </div>

      <StickyPremiumSummary headerRef={headerRef} premium={estimateIndicativePremium(state)} />

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
  const index = QUOTE_STEP_ORDER.indexOf(state.step);

  return (
    <div className={styles.actions}>
      <button type="button" disabled={index === 0} onClick={() => dispatch({ type: 'PREV_STEP' })}>
        Back
      </button>
      <button
        type="button"
        disabled={index === QUOTE_STEP_ORDER.length - 1}
        onClick={() => dispatch({ type: 'NEXT_STEP' })}
      >
        Next
      </button>
    </div>
  );
}

function ApplicantStep(): ReactElement {
  const [state, dispatch] = useQuote();

  return (
    <section>
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

      <div className={styles.field}>
        <label htmlFor="quote-city">City</label>
        <input
          id="quote-city"
          value={state.city}
          onChange={(event) =>
            dispatch({ type: 'SET_LOCATION', city: event.target.value, state: state.state })
          }
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="quote-state">State</label>
        <input
          id="quote-state"
          value={state.state}
          onChange={(event) =>
            dispatch({ type: 'SET_LOCATION', city: state.city, state: event.target.value })
          }
        />
      </div>

      <h3>Insured parties</h3>
      {state.insured.map((party) => (
        <div key={party.key} className={styles.insuredRow}>
          {/* Each iteration mounts its own <TextField>, so each gets its own
              useId()-generated id — three parties on screen at once means
              three distinct label/input pairs, not one id shared by three
              inputs. See TextField's header. */}
          <TextField
            label="Full name"
            value={party.fullName}
            onChange={(event) =>
              dispatch({ type: 'UPDATE_INSURED', key: party.key, patch: { fullName: event.target.value } })
            }
          />
          <TextField
            label="Date of birth"
            type="date"
            value={party.dateOfBirth}
            onChange={(event) =>
              dispatch({
                type: 'UPDATE_INSURED',
                key: party.key,
                patch: { dateOfBirth: event.target.value },
              })
            }
          />
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
    <section>
      <div className={styles.field}>
        <label htmlFor="quote-sum-insured">Sum insured</label>
        <input
          id="quote-sum-insured"
          type="number"
          min={0}
          step={10_000}
          value={state.sumInsured}
          onChange={(event) => dispatch({ type: 'SET_SUM_INSURED', sumInsured: Number(event.target.value) })}
        />
      </div>

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

      <div className={styles.field}>
        <label htmlFor="quote-prior-claims">Prior claims (last 3 years)</label>
        <input
          id="quote-prior-claims"
          type="number"
          min={0}
          value={state.priorClaims}
          onChange={(event) => dispatch({ type: 'SET_PRIOR_CLAIMS', count: Number(event.target.value) })}
        />
      </div>
    </section>
  );
}

function CoverageStep(): ReactElement {
  const [state, dispatch] = useQuote();
  const entries = CATALOGUE[state.type];

  return (
    <section>
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
    <section>
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
