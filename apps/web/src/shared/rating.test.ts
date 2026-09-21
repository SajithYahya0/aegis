import {describe, expect, it} from 'vitest';
import {annualPremium} from './rating';

const motor ={
    type: 'motor' as const,
    sumInsured: 500000,
    termMonths: 12,
    priorClaims: 0,
    optionalCovers: 0,
};

describe('annualPremium', () => {
    it('applies the base rate per mile not per cent', () => {
        expect(annualPremium(motor)).toBe(12250);
    });

    it('multiplies by claims loading instead of adding a flat amount', () => {
        expect(annualPremium({...motor, priorClaims: 2})).toBe(14210);
    });

    it('comounds the cover loading on top of claims loading', () => {
        expect(annualPremium({...motor, priorClaims: 2, optionalCovers: 3})).toBe(14850);
    });

    it('switches to a long-term discount if the term is 24 months, not after after it', () => {
        expect(annualPremium({...motor, termMonths: 23})).toBe(12250);
        expect(annualPremium({...motor, termMonths: 24})).toBe(11640);
    });

    it('rounds to the nearest 10', () => {
        expect(annualPremium({...motor, sumInsured: 123456})).toBe(3020);
    });

});