import type { Coverage, PolicyType } from './domain';

const BASE_RATE_PER_MILLE: Record<PolicyType, number> = {
  motor: 24.5,
  health: 31,
  property: 4.5,
  life: 6.4,
};

const LOADING_PER_PRIOR_CLAIM = 0.08;
const LOADING_PER_OPTIONAL_COVER = 0.015;
const LONG_TERM_DISCOUNT = 0.05;
const LONG_TERM_MONTHS = 24;

export interface CoverageTemplate {
  code: string;
  label: string;
  limitFraction: number;
  deductible: number;
  mandatory: boolean;
}

export const COVERAGE_TEMPLATES: Record<PolicyType, readonly CoverageTemplate[]> = {
  motor: [
    { code: 'MOTOR_OD', label: 'Own damage', limitFraction: 1, deductible: 5000,
      mandatory: true },
    { code: 'MOTOR_TP', label: 'Third-party liability', limitFraction: 0.75, deductible: 0,
      mandatory: true },
    { code: 'MOTOR_ZD', label: 'Zero depreciation', limitFraction: 0.4, deductible: 2500,
      mandatory: false },
  ],
  health: [
    { code: 'HEALTH_IP', label: 'In-patient treatment', limitFraction: 1, deductible: 0,
      mandatory: true },
    { code: 'HEALTH_DC', label: 'Day-care procedures', limitFraction: 0.5, deductible: 2000,
      mandatory: true },
    { code: 'HEALTH_MAT', label: 'Maternity cover', limitFraction: 0.15, deductible: 10000,
      mandatory: false },
  ],
  property: [
    { code: 'PROP_FIRE', label: 'Fire and allied perils', limitFraction: 1, deductible: 25000,
      mandatory: true },
    { code: 'PROP_BURG', label: 'Burglary and theft', limitFraction: 0.6, deductible: 15000,
      mandatory: true },
    { code: 'PROP_FLOOD', label: 'Flood and inundation', limitFraction: 0.5, deductible: 50000,
      mandatory: false },
  ],
  life: [
    { code: 'LIFE_TERM', label: 'Term sum assured', limitFraction: 1, deductible: 0,
      mandatory: true },
    { code: 'LIFE_ADB', label: 'Accidental death benefit', limitFraction: 0.5, deductible: 0,
      mandatory: false },
    { code: 'LIFE_CI', label: 'Critical illness rider', limitFraction: 0.25, deductible: 0,
      mandatory: false },
  ],
};

export interface PremiumInput {
  type: PolicyType;
  sumInsured: number;
  termMonths: number;
  priorClaims: number;
  optionalCovers: number;
}

export function annualPremium(input: PremiumInput): number {
  const base = (BASE_RATE_PER_MILLE[input.type] * input.sumInsured) / 1000;
  const withClaims = base * (1 + input.priorClaims * LOADING_PER_PRIOR_CLAIM);
  const withCovers = withClaims * (1 + input.optionalCovers * LOADING_PER_OPTIONAL_COVER);
  const termAdjusted =
    input.termMonths >= LONG_TERM_MONTHS ? withCovers * (1 - LONG_TERM_DISCOUNT) : withCovers;
  return Math.round(termAdjusted / 10) * 10;
}

export function coveragesFor(
  type: PolicyType,
  sumInsured: number,
  optionalCovers: number,
): Coverage[] {
  const templates = COVERAGE_TEMPLATES[type];
  const optional = templates.filter((template) => !template.mandatory).slice(0, optionalCovers);
  return templates
    .filter((template) => template.mandatory || optional.includes(template))
    .map((template) => ({
      code: template.code,
      label: template.label,
      limit: Math.round(sumInsured * template.limitFraction),
      deductible: template.deductible,
      mandatory: template.mandatory,
    }));
}
