/**
 * WHY THIS EXISTS:
 *   The underwriting decision's rules and its type, declared once — the second
 *   Zod schema in the app, and deliberately a different *shape* of problem
 *   from `claimSchema.ts`.
 *
 *   `claimSchema`'s cross-field rule compares two values inside the form
 *   (`amount` against the policy the form names). This one compares a form
 *   value against something the form does not own: `maxLoadingPct`, which
 *   arrives from `GET /underwriting/limits` at run time. That is why this
 *   module exports a schema *factory* rather than a schema — the rule cannot
 *   be written until the request has landed.
 *
 * CONCEPTS: W4-D5-02, W4-D5-03
 *
 * WITHOUT THIS:
 *   THE FACTORY, SPECIFICALLY — a module-level `decisionSchema` with the
 *   loading cap written in as a literal: the number is then in two places, the
 *   backend's and this file's, and they disagree the first time an
 *   underwriter's authority changes. The visible symptom is the worst kind:
 *   the form accepts 45%, the endpoint rejects it, and the message the user
 *   gets is about a rule the screen never mentioned. Deriving the schema from
 *   the fetched limits means the form can only ever enforce what the server
 *   said, and the two cannot drift.
 *
 *   THE CONDITIONAL RULE: `loadingPct` means something only when the outcome
 *   is `accept`. A referred or declined risk is not being priced on this
 *   screen, so a non-zero loading on one of those is not a harmless extra
 *   keystroke — it is a rate that was typed, submitted, stored, and will never
 *   be applied, which is worse than a blank because it looks like a decision.
 *   Per-field rules cannot express "invalid, but only when another field says
 *   so", so this is a `superRefine` on the object with an explicit
 *   `path: ['loadingPct']` — the
 *   same reason `claimSchema` gives: `trigger()` and the field's own
 *   `helperText` both match issues by path, so a root-level issue would be
 *   raised and then rendered nowhere.
 *
 *   THE NOTE MINIMUM: without it, "ok" is a complete audit trail for a
 *   ₹40,00,000 risk. The mock backend enforces its own, shorter minimum (10
 *   characters) on the same field, and the two numbers are deliberately
 *   different — see `mockBackend.ts`. A client rule is a courtesy; the
 *   endpoint's is the rule, and having both means the 422 path is reachable
 *   from a real submission rather than only in theory.
 */

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
