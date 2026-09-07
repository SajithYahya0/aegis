import { z } from 'zod';
import type { UnderwritingDecisionOutcome } from '../../shared/http/endpoints';

export const DECISION_OUTCOMES = [
  'accept',
  'refer',
  'decline',
] as const satisfies readonly UnderwritingDecisionOutcome[];

export const DECISION_LABEL: Record<UnderwritingDecisionOutcome, string> = {
  accept: 'Accept at the quoted rate',
  refer: 'Refer to the treaty underwriter',
  decline: 'Decline the risk',
};

/** The client-side note minimum. The server's is 10 — see the header. */
export const MIN_NOTE_CHARS = 20;

/**
 * Builds the schema for one set of authority limits.
 *
 * Takes the whole `maxLoadingPct` rather than a pre-built message so the cap
 * can be named *in* the error text: "40% is the most you may load on your own
 * authority" is actionable, "invalid value" is not.
 */
export function makeDecisionSchema(maxLoadingPct: number) {
  return z
    .object({
      policyId: z.string().min(1, 'Pick a policy from the referral queue.'),

      outcome: z.enum(DECISION_OUTCOMES),

      /*
       * Same `valueAsNumber` story as `claimSchema`'s `amount`: an empty box
       * arrives as `NaN`, which `z.number()` rejects as a type error, so the
       * message belongs on the constructor. `.max()` is derived from the
       * fetched limit rather than hard-coded — the whole reason this is a
       * factory.
       */
      loadingPct: z
        .number({ error: 'Enter a rate loading, or 0 for none.' })
        .min(0, 'A rate loading cannot be negative.')
        .max(
          maxLoadingPct,
          `${maxLoadingPct}% is the most you may load on your own authority; refer above that.`,
        ),

      note: z
        .string()
        .trim()
        .min(MIN_NOTE_CHARS, `Record the reasoning in at least ${MIN_NOTE_CHARS} characters.`),
    })
    .superRefine((draft, ctx) => {
      if (draft.outcome !== 'accept' && draft.loadingPct > 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['loadingPct'],
          message: `A ${draft.outcome === 'decline' ? 'declined' : 'referred'} risk is not being priced here, so it carries no loading.`,
        });
      }
    });
}

/**
 * The form's value type. Derived from the factory's *return* type, so it
 * follows the schema automatically — `z.infer<ReturnType<typeof …>>` rather
 * than a second interface, for the same reason `claimSchema.ts` gives.
 */
export type DecisionValues = z.infer<ReturnType<typeof makeDecisionSchema>>;
