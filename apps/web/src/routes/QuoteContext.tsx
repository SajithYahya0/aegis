import {
  createContext,
  useContext,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactElement,
  type ReactNode,
} from 'react';
import type { PolicyType } from '../shared/domain';

export type QuoteStep = 'applicant' | 'risk' | 'coverage' | 'review';

export const QUOTE_STEPS: readonly QuoteStep[] = ['applicant', 'risk', 'coverage', 'review'];

export type Relationship = 'self' | 'spouse' | 'child' | 'parent';

export interface InsuredParty {
  key: string;
  fullName: string;
  dateOfBirth: string;
  relationship: Relationship;
}

export interface QuoteDraft {
  step: QuoteStep;
  type: PolicyType;
  sumInsured: number;
  termMonths: number;
  city: string;
  insured: InsuredParty[];
  optionalCoverageCodes: string[];
  priorClaims: number;
}

export type QuoteAction =
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'setType'; policyType: PolicyType }
  | { type: 'setNumber'; field: 'sumInsured' | 'termMonths' | 'priorClaims'; value: number }
  | { type: 'setCity'; city: string }
  | { type: 'addInsured' }
  | { type: 'updateInsured'; key: string; patch: Partial<Omit<InsuredParty, 'key'>> }
  | { type: 'removeInsured'; key: string }
  | { type: 'toggleCoverage'; code: string }
  | { type: 'reset' };

const BLANK_DRAFT: QuoteDraft = {
  step: 'applicant',
  type: 'motor',
  sumInsured: 500_000,
  termMonths: 12,
  city: '',
  insured: [],
  optionalCoverageCodes: [],
  priorClaims: 0,
};

function stepAt(current: QuoteStep, offset: number): QuoteStep {
  const index = QUOTE_STEPS.indexOf(current) + offset;
  return QUOTE_STEPS[Math.min(Math.max(index, 0), QUOTE_STEPS.length - 1)];
}

export function quoteReducer(state: QuoteDraft, action: QuoteAction): QuoteDraft {
  switch (action.type) {
    case 'next':
      return { ...state, step: stepAt(state.step, 1) };
    case 'back':
      return { ...state, step: stepAt(state.step, -1) };
    case 'setType':
      return { ...state, type: action.policyType, optionalCoverageCodes: [] };
    case 'setNumber':
      return { ...state, [action.field]: action.value };
    case 'setCity':
      return { ...state, city: action.city };
    case 'addInsured':
      return {
        ...state,
        insured: [
          ...state.insured,
          {
            key: crypto.randomUUID(),
            fullName: '',
            dateOfBirth: '',
            relationship: state.insured.length === 0 ? 'self' : 'spouse',
          },
        ],
      };
    case 'updateInsured':
      return {
        ...state,
        insured: state.insured.map((party) =>
          party.key === action.key ? { ...party, ...action.patch } : party,
        ),
      };
    case 'removeInsured':
      return { ...state, insured: state.insured.filter((party) => party.key !== action.key) };
    case 'toggleCoverage':
      return {
        ...state,
        optionalCoverageCodes: state.optionalCoverageCodes.includes(action.code)
          ? state.optionalCoverageCodes.filter((code) => code !== action.code)
          : [...state.optionalCoverageCodes, action.code],
      };
    case 'reset':
      return BLANK_DRAFT;
  }
}

export interface QuoteContextValue {
  draft: QuoteDraft;
  dispatch: Dispatch<QuoteAction>;
}

const QuoteContext = createContext<QuoteContextValue | null>(null);

export function QuoteProvider({ children }: { children: ReactNode }): ReactElement {
  const [draft, dispatch] = useReducer(quoteReducer, BLANK_DRAFT);
  const value = useMemo(() => ({ draft, dispatch }), [draft]);
  return <QuoteContext.Provider value={value}>{children}</QuoteContext.Provider>;
}

export function useQuote(): QuoteContextValue {
  const value = useContext(QuoteContext);
  if (!value) throw new Error('useQuote must be used inside <QuoteProvider>.');
  return value;
}
