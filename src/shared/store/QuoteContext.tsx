/**
 * WHY THIS EXISTS:
 *   The quote wizard's entire state machine. A `useReducer` rather than a
 *   handful of `useState` calls because the steps are not independent —
 *   moving from "risk" to "coverage" depends on `type` chosen in "applicant",
 *   and a single `dispatch` keeps every transition auditable in one switch
 *   instead of scattered across four components' worth of setters.
 *
 *   The context is split in two — `QuoteStateContext` carries the `Quote`,
 *   `QuoteDispatchContext` carries only `dispatch` — because `dispatch` from
 *   `useReducer` is referentially stable for the life of the component. A
 *   step component that only needs to fire actions (say, a coverage
 *   checkbox) can subscribe to `QuoteDispatchContext` alone and never
 *   re-render when the quote state changes elsewhere in the wizard.
 *
 * CONCEPTS: W2-D2-06, W2-D3-01, W2-D3-03, W2-D3-04, W3-D1-04
 *
 * WITHOUT THIS:
 *   Un-split: if state and dispatch travelled in one context value, every
 *   consumer of that value — including a step that only ever calls
 *   `dispatch({ type: 'NEXT_STEP' })` — would re-render on every keystroke in
 *   every other step, because the provider value's identity changes whenever
 *   `state` does. `React.memo` on a step component would be defeated by its
 *   own provider.
 *
 *   No lazy init: `useReducer(quoteReducer, createBlankQuote())` calls
 *   `createBlankQuote()` — and would, if it read localStorage itself, read it
 *   — on *every* render of `QuoteProvider`, not just the first. The lazy
 *   third-argument form only ever runs once, on mount, which is the only
 *   place a draft should be rehydrated from storage.
 *
 *   No draft persistence: refreshing mid-wizard (or StackBlitz's dev server
 *   restarting) loses every field the agent typed, with no warning.
 */

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import { isLabEnabled } from '../labs/registry';
import type { InsuredParty, PolicyType, Quote, QuoteStep } from '../types';

const DRAFT_KEY = 'aegis:quote-draft';

const STEP_ORDER: readonly QuoteStep[] = ['applicant', 'risk', 'coverage', 'review'];

function nowIso(): string {
  return new Date().toISOString();
}

function createBlankQuote(): Quote {
  const now = nowIso();
  return {
    id: crypto.randomUUID(),
    step: 'applicant',
    type: 'motor',
    sumInsured: 500_000,
    termMonths: 12,
    city: '',
    state: '',
    insured: [],
    selectedCoverageCodes: [],
    priorClaims: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Reads the persisted draft, if any, or falls back to a blank quote. Runs
 * exactly once, as `useReducer`'s lazy init argument — see the header.
 */
function initQuoteDraft(): Quote {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return createBlankQuote();
    const parsed = JSON.parse(raw) as Quote;
    // Minimal shape check: a draft saved by an earlier, incompatible version
    // of this reducer should not crash the wizard on load.
    if (typeof parsed.id !== 'string' || typeof parsed.step !== 'string') {
      return createBlankQuote();
    }
    return parsed;
  } catch {
    return createBlankQuote();
  }
}

function persistDraft(quote: Quote): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(quote));
  } catch {
    // Storage can be full or disabled (private browsing); the wizard still
    // works in-memory for the rest of the session, it just will not survive
    // a reload.
  }
}

/* -------------------------------------------------------------------------- */
/* Actions                                                                    */
/* -------------------------------------------------------------------------- */

export type QuoteAction =
  | { type: 'SET_STEP'; step: QuoteStep }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'SET_TYPE'; policyType: PolicyType }
  | { type: 'SET_SUM_INSURED'; sumInsured: number }
  | { type: 'SET_TERM_MONTHS'; termMonths: number }
  | { type: 'SET_LOCATION'; city: string; state: string }
  | { type: 'ADD_INSURED' }
  | { type: 'UPDATE_INSURED'; key: string; patch: Partial<Omit<InsuredParty, 'key'>> }
  | { type: 'REMOVE_INSURED'; key: string }
  | { type: 'TOGGLE_COVERAGE'; code: string }
  | { type: 'SET_PRIOR_CLAIMS'; count: number }
  | { type: 'RESET' };

function quoteReducer(state: Quote, action: QuoteAction): Quote {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.step, updatedAt: nowIso() };

    case 'NEXT_STEP': {
      const index = STEP_ORDER.indexOf(state.step);
      const next = STEP_ORDER[Math.min(index + 1, STEP_ORDER.length - 1)]!;
      return { ...state, step: next, updatedAt: nowIso() };
    }

    case 'PREV_STEP': {
      const index = STEP_ORDER.indexOf(state.step);
      const prev = STEP_ORDER[Math.max(index - 1, 0)]!;
      return { ...state, step: prev, updatedAt: nowIso() };
    }

    case 'SET_TYPE':
      // Coverage selections belong to the previous type's catalogue; carrying
      // them across a type change would let a health rider ride along on a
      // motor quote.
      return { ...state, type: action.policyType, selectedCoverageCodes: [], updatedAt: nowIso() };

    case 'SET_SUM_INSURED':
      return { ...state, sumInsured: action.sumInsured, updatedAt: nowIso() };

    case 'SET_TERM_MONTHS':
      return { ...state, termMonths: action.termMonths, updatedAt: nowIso() };

    case 'SET_LOCATION':
      return { ...state, city: action.city, state: action.state, updatedAt: nowIso() };

    case 'ADD_INSURED': {
      const party: InsuredParty = {
        key: crypto.randomUUID(),
        fullName: '',
        dateOfBirth: '',
        relationship: state.insured.length === 0 ? 'self' : 'spouse',
      };

      if (isLabEnabled('mutating-reducer')) {
        // DEFECT (W2-D3-02, off by default): mutates the existing array and
        // returns the very same `state` object. `useReducer` compares the
        // returned state to the previous state with `Object.is` and, seeing
        // the identical reference, skips the re-render — so `party` is really
        // in `state.insured` (a DevTools inspection would show it) but
        // nothing on screen reflects it until an unrelated action forces a
        // fresh object through.
        state.insured.push(party);
        return state;
      }

      return { ...state, insured: [...state.insured, party], updatedAt: nowIso() };
    }

    case 'UPDATE_INSURED':
      return {
        ...state,
        insured: state.insured.map((party) =>
          party.key === action.key ? { ...party, ...action.patch } : party,
        ),
        updatedAt: nowIso(),
      };

    case 'REMOVE_INSURED':
      return {
        ...state,
        insured: state.insured.filter((party) => party.key !== action.key),
        updatedAt: nowIso(),
      };

    case 'TOGGLE_COVERAGE': {
      const has = state.selectedCoverageCodes.includes(action.code);
      return {
        ...state,
        selectedCoverageCodes: has
          ? state.selectedCoverageCodes.filter((code) => code !== action.code)
          : [...state.selectedCoverageCodes, action.code],
        updatedAt: nowIso(),
      };
    }

    case 'SET_PRIOR_CLAIMS':
      return { ...state, priorClaims: action.count, updatedAt: nowIso() };

    case 'RESET':
      return createBlankQuote();
  }
}

/* -------------------------------------------------------------------------- */
/* Split context + provider                                                   */
/* -------------------------------------------------------------------------- */

const QuoteStateContext = createContext<Quote | null>(null);
const QuoteDispatchContext = createContext<Dispatch<QuoteAction> | null>(null);

export function QuoteProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(quoteReducer, undefined, initQuoteDraft);

  useEffect(() => {
    persistDraft(state);
  }, [state]);

  return (
    <QuoteDispatchContext.Provider value={dispatch}>
      <QuoteStateContext.Provider value={state}>{children}</QuoteStateContext.Provider>
    </QuoteDispatchContext.Provider>
  );
}

export function useQuote(): [Quote, Dispatch<QuoteAction>] {
  const state = useContext(QuoteStateContext);
  const dispatch = useContext(QuoteDispatchContext);
  if (!state || !dispatch) {
    throw new Error('useQuote() must be called within a <QuoteProvider>.');
  }
  return [state, dispatch];
}

export const QUOTE_STEP_ORDER = STEP_ORDER;
