import { describe, expect, it } from 'vitest';
import { annualPremium, coveragesFor } from './rating';

const MOTOR_MILLION = {
  type: 'motor' as const,
  sumInsured: 1_000_000,
  termMonths: 12,
  priorClaims: 0,
  optionalCovers: 0,
};

describe('annualPremium', () => {
  it('rates the sum insured at the base rate for the product', () => {
    expect(annualPremium(MOTOR_MILLION)).toBe(24_500);
    expect(annualPremium({ ...MOTOR_MILLION, type: 'property' })).toBe(4_500);
  });

  it('loads for prior claims and optional covers, and discounts a long term', () => {
    expect(annualPremium({ ...MOTOR_MILLION, priorClaims: 2 })).toBe(28_420);
    expect(annualPremium({ ...MOTOR_MILLION, optionalCovers: 1 })).toBe(24_870);

    expect(annualPremium({ ...MOTOR_MILLION, termMonths: 23 })).toBe(24_500);
    expect(annualPremium({ ...MOTOR_MILLION, termMonths: 24 })).toBe(23_280);

    const awkward = annualPremium({ ...MOTOR_MILLION, sumInsured: 733_333, priorClaims: 1 });
    expect(awkward % 10).toBe(0);
  });
});

describe('coveragesFor', () => {
  it('writes every mandatory cover and only the optional ones bought', () => {
    const motor = coveragesFor('motor', 1_000_000, 0);

    expect(motor.map((cover) => cover.code)).toEqual(['MOTOR_OD', 'MOTOR_TP']);
    expect(motor[0].limit).toBe(1_000_000);
    expect(motor[1].limit).toBe(750_000);

    expect(coveragesFor('life', 5_000_000, 1).map((cover) => cover.code)).toEqual([
      'LIFE_TERM',
      'LIFE_ADB',
    ]);
  });
});
