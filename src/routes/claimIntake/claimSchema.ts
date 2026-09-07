import { z } from 'zod';
import { policiesById } from '../../shared/data';
import { formatCurrency } from '../../shared/format';
import type { ClaimType } from '../../shared/types';

/**
 * The claim types the intake form offers, as a tuple so `z.enum` can infer the
 * literal union from it.
 *
 * `satisfies readonly ClaimType[]` rather than a type annotation: an
 * annotation would widen the tuple back to `ClaimType[]` and `z.enum` would
 * lose the literals it needs. `satisfies` keeps the literals *and* still fails
 * the build if a value here is not a real `ClaimType` — which is the direction
 * that actually goes wrong, because a typo'd option renders fine and produces
 * a claim the backend rejects.
 */
export const CLAIM_TYPES = [
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
] as const satisfies readonly ClaimType[];

export const CLAIM_TYPE_LABEL: Record<ClaimType, string> = {
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

/** Minimum useful narrative. Shorter than this is "car hit" — not a loss report. */
export const MIN_DESCRIPTION_CHARS = 20;

/**
 * Today, as the `YYYY-MM-DD` string a native date input produces.
 *
 * Computed per call, not captured at module load: this module is evaluated
 * once when the wizard's chunk is first imported, and a console left open
 * overnight would otherwise go on rejecting today's date as "in the future"
 * against yesterday's constant.
 */
function todayIso(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export { todayIso };

/**
 * Loose enough to accept the shapes an Indian claimant actually gives (`+91
 * 98765 43210`, `098765-43210`) and strict enough to reject a name typed into
 * the wrong box. Digits are counted after stripping formatting rather than
 * matched positionally, because a positional pattern is the kind of rule that
 * silently locks out every number from one region.
 */
const PHONE_DIGITS = /^[+\d][\d\s().-]{6,}$/;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const claimSchema = z
  .object({
    /*
     * "Must exist in the book" is a *data* rule, not a format rule, so it is a
     * refine against the same `policiesById` index every other surface reads.
     * Without it the only thing stopping a claim against a non-existent policy
     * is the mock backend's 404 — a round trip, after the review step, with
     * the wizard already congratulating itself.
     */
    policyId: z
      .string()
      .min(1, 'Select the policy this claim is filed against.')
      .refine((id) => policiesById.has(id), 'That policy number is not in the book.'),

    type: z.enum(CLAIM_TYPES),

    /*
     * `register('amount', { valueAsNumber: true })` hands an empty input
     * through as `NaN`, which `z.number()` rejects as a type error rather than
     * as a range error — hence the message on the constructor rather than only
     * on `.positive()`. Without it the agent is told "Invalid input: expected
     * number, received NaN", which is a sentence about the resolver.
     */
    amount: z
      .number({ error: 'Enter the amount claimed, in rupees.' })
      .positive('The amount claimed must be greater than zero.'),

    incidentDate: z
      .string()
      .min(1, 'Enter the date of the incident.')
      .refine((value) => value <= todayIso(), 'The incident date cannot be in the future.'),

    incidentLocation: z
      .string()
      .trim()
      .min(3, 'Enter where the loss occurred — the assessor has to visit it.'),

    description: z
      .string()
      .trim()
      .min(
        MIN_DESCRIPTION_CHARS,
        `Describe the loss in at least ${MIN_DESCRIPTION_CHARS} characters.`,
      ),

    claimantPhone: z
      .string()
      .trim()
      .regex(PHONE_DIGITS, 'Enter a phone number the claimant can be reached on.'),

    /*
     * Optional, and therefore validated as "blank or well-formed" rather than
     * marked `.optional()`. The field is always present in the form's values —
     * a controlled input's empty state is `''`, not `undefined` — so
     * `.optional()` would describe a shape this form can never produce and
     * would leave `''` failing the email check.
     */
    claimantEmail: z
      .string()
      .trim()
      .refine(
        (value) => value === '' || EMAIL.test(value),
        'Enter a valid email address, or leave it blank.',
      ),

    /** Genuinely optional: a household water-damage claim has no FIR. */
    policeReportNumber: z.string().trim(),

    thirdPartyInvolved: z.boolean(),
  })
  .superRefine((draft, ctx) => {
    const policy = policiesById.get(draft.policyId);
    // `policyId` has already failed its own refine in this case; adding a
    // second issue here would show the agent two errors for one mistake.
    if (!policy) return;

    if (draft.amount > policy.sumInsured) {
      ctx.addIssue({
        code: 'custom',
        // See the header: the path is what lets the per-step `trigger()` in
        // the wizard see this issue at all.
        path: ['amount'],
        message: `${policy.id} is insured for ${formatCurrency(policy.sumInsured)}; a claim cannot exceed it.`,
      });
    }
  });

/**
 * The form's value type. `useForm<ClaimDraftValues>` in `ClaimIntakeWizard`
 * takes this and nothing else — there is deliberately no hand-written
 * interface for a claim draft anywhere in this folder.
 */
export type ClaimDraftValues = z.infer<typeof claimSchema>;

/**
 * What an untouched form holds. Exported so the wizard and its test agree on
 * the starting point.
 *
 * `amount` is deliberately absent, and it is the only field that is. Every
 * other control is a string or a boolean whose empty state is a real value, so
 * defaulting them is what keeps them controlled from the first render. A
 * number input has no such value: `0` is a figure the agent might have meant
 * and would be painted into the box before they typed anything, and `NaN`
 * stringifies into the DOM as the literal text `NaN`. Leaving it out starts
 * the box empty and lets `valueAsNumber` hand the resolver the `NaN` that
 * produces "Enter the amount claimed, in rupees." The type is therefore
 * `Omit<…, 'amount'>` rather than the full shape — stated, not implied, so
 * that a field added to the schema and forgotten here still fails the build.
 */
export const EMPTY_CLAIM_DRAFT: Omit<ClaimDraftValues, 'amount'> = {
  policyId: '',
  type: 'accident',
  incidentDate: '',
  incidentLocation: '',
  description: '',
  claimantPhone: '',
  claimantEmail: '',
  policeReportNumber: '',
  thirdPartyInvolved: false,
};
