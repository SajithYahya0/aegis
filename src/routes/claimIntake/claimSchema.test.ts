/**
 * WHY THIS EXISTS:
 *   Pins the two rules in `claimSchema.ts` that cannot be read off the field
 *   definitions — the cross-field amount check and Zod's ordering around it —
 *   and the one behaviour the wizard's per-step gate depends on: that the
 *   cross-field issue is reported *at `amount`* rather than at the object root.
 *
 *   This is the half of the react-hook-form migration that the old wizard
 *   could not have: the rules used to be `if` statements inside a component,
 *   so testing "a claim cannot exceed the sum insured" meant mounting the
 *   dialog and driving it through two steps of UI. Extracting them into a
 *   schema made them a pure function of a draft.
 *
 * CONCEPTS: W4-D5-02, W3-D2-07
 *
 * WITHOUT THIS:
 *   The `path: ['amount']` on the `superRefine` issue looks like a detail and
 *   is not: drop it and the issue lands on the form root, `trigger(['amount',
 *   …])` in the wizard's step gate stops seeing it, and an over-limit claim
 *   walks past the Incident step to the review screen. Nothing else in the
 *   suite would notice — the schema still rejects the draft, just one step too
 *   late to be fixed where it was entered.
 */

import { describe, expect, it } from 'vitest';
import { policies } from '../../shared/data';
import { EMPTY_CLAIM_DRAFT, claimSchema, type ClaimDraftValues } from './claimSchema';

const policy = policies[0];

/** A draft that passes every rule, so each test can break exactly one thing. */
function validDraft(overrides: Partial<ClaimDraftValues> = {}): ClaimDraftValues {
  return {
    ...EMPTY_CLAIM_DRAFT,
    policyId: policy.id,
    amount: Math.round(policy.sumInsured / 2),
    incidentDate: '2024-03-01',
    incidentLocation: 'Anna Salai, Chennai',
    description: 'Rear-ended at a signal; bumper and boot lid damaged.',
    claimantPhone: '+91 98765 43210',
    ...overrides,
  };
}

describe('claimSchema', () => {
  it('accepts a fully populated draft', () => {
    expect(claimSchema.safeParse(validDraft()).success).toBe(true);
  });

  it('rejects a policy id that is not in the book', () => {
    const result = claimSchema.safeParse(validDraft({ policyId: 'POL-NOPE' }));
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path[0])).toContain('policyId');
  });

  it('reports an amount above the sum insured at the amount field, not the root', () => {
    const result = claimSchema.safeParse(
      validDraft({ amount: policy.sumInsured + 1 }),
    );
    expect(result.success).toBe(false);
    // The path is what the wizard's per-step `trigger(['amount', …])` matches
    // on. A root-level issue would still fail the parse and would still let the
    // agent leave the Incident step.
    expect(result.error?.issues[0]?.path).toEqual(['amount']);
  });

  it('still runs the cross-field check when a field-level rule is also failing', () => {
    /*
     * This is the assertion that corrected a wrong claim in `claimSchema.ts`'s
     * header. Zod 3 aborts before object-level refinements once an inner field
     * has failed, so the expectation written first was one issue
     * (`description`) and the over-limit amount appearing only after the
     * description was fixed. Zod 4 — 4.5.4 here — reports both, which is the
     * better behaviour and is now what the header describes.
     *
     * It is pinned rather than left as a happy accident: a Zod upgrade that
     * restored the old ordering would change which errors an agent sees in one
     * pass without changing a line of this repo, and this is the test that
     * would say so.
     */
    const result = claimSchema.safeParse(
      validDraft({ amount: policy.sumInsured + 1, description: 'too short' }),
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path[0]).sort()).toEqual([
      'amount',
      'description',
    ]);
  });

  it('rejects an incident date in the future', () => {
    const nextYear = `${new Date().getFullYear() + 1}-01-01`;
    const result = claimSchema.safeParse(validDraft({ incidentDate: nextYear }));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['incidentDate']);
  });

  it('requires at least 20 characters of description', () => {
    const result = claimSchema.safeParse(validDraft({ description: 'Hit a pole.' }));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toMatch(/at least 20 characters/);
  });

  it('treats a blank claimant email as valid and a malformed one as not', () => {
    expect(claimSchema.safeParse(validDraft({ claimantEmail: '' })).success).toBe(true);
    expect(claimSchema.safeParse(validDraft({ claimantEmail: 'nope' })).success).toBe(false);
  });

  it('rejects a non-positive amount', () => {
    expect(claimSchema.safeParse(validDraft({ amount: 0 })).success).toBe(false);
    expect(claimSchema.safeParse(validDraft({ amount: Number.NaN })).success).toBe(false);
  });
});
