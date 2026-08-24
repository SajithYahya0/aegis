/**
 * WHY THIS EXISTS:
 *   The single list of deliberate defects and the store that tracks which are
 *   switched on. Plain module state with a subscribe/notify pair — not
 *   Context — because a defect like the conditional-hook demo has to read a
 *   toggle from inside a component that is deliberately breaking the rules of
 *   hooks, and a `useContext` call cannot be trusted to survive next to that.
 *
 * CONCEPTS: (infrastructure for W2-D1-05, W2-D1-06, W2-D3-02, W3-D2-01,
 *   W3-D4-04, W3-D4-03, C-05 — see the individual demo files, QuoteContext and
 *   PolicyClaimsTab for where each one fires)
 *
 * WITHOUT THIS:
 *   Every defect would need its own bespoke boolean prop threaded down from
 *   wherever it is demonstrated, so turning one on for a live walkthrough
 *   means editing source and reloading rather than clicking a checkbox in
 *   `LabPanel`. CLAUDE.md requires these toggles to be runtime-flippable and
 *   off by default; a compile-time flag satisfies neither.
 */

export type LabDefectId =
  | 'conditional-hook'
  | 'mutating-reducer'
  | 'object-literal-effect-dep'
  | 'stale-closure-interval'
  | 'layout-effect-flicker'
  | 'risk-feed-outage'
  | 'claim-submit-failure';

export interface LabDefect {
  id: LabDefectId;
  title: string;
  matrixId: string;
  summary: string;
  symptom: string;
}

export const LAB_DEFECTS: readonly LabDefect[] = [
  {
    id: 'conditional-hook',
    title: 'Conditional hook call',
    matrixId: 'W3-D2-01',
    summary:
      'A useState call moves behind an `if` that depends on state, so the number ' +
      'of hooks called changes between renders instead of staying fixed.',
    symptom:
      'Click "Tick" twice with this on: React throws "Rendered more hooks than ' +
      'during the previous render" and the demo (and everything below it, with ' +
      'no boundary yet to catch it) unmounts. Reload the page to recover.',
  },
  {
    id: 'mutating-reducer',
    title: 'Mutating reducer state',
    matrixId: 'W2-D3-02',
    summary:
      'The quote reducer’s ADD_INSURED branch pushes onto the existing ' +
      'insured array and returns the same top-level state object instead of a ' +
      'copy.',
    symptom:
      'Go to /quote → Applicant step → "Add insured party". Nothing appears — ' +
      'useReducer bails out via Object.is(prevState, nextState). Switch steps ' +
      'and back to force a re-render: not one row shows up but two, because ' +
      'StrictMode (see main.tsx) double-invokes the reducer to catch exactly ' +
      'this kind of impurity, and a mutation — unlike a pure computation — ' +
      'really does happen twice.',
  },
  {
    id: 'object-literal-effect-dep',
    title: 'Object-literal effect dependency',
    matrixId: 'W2-D1-05',
    summary:
      'An effect depends on a `{ ... }` literal that is a new reference every ' +
      'render, so the dependency never looks "unchanged" and the effect fires ' +
      'every render.',
    symptom:
      'The run counter climbs on its own without any input, hundreds of times a ' +
      'second, instead of running once. Capped at 500 here so the tab does not ' +
      'actually freeze — a real occurrence of this bug has no such cap.',
  },
  {
    id: 'stale-closure-interval',
    title: 'Stale closure in an interval',
    matrixId: 'W2-D1-06',
    summary:
      'setInterval is created inside an effect with an empty dependency array, ' +
      'so its callback closes over the count from the render that mounted it ' +
      'and never sees a newer one.',
    symptom:
      'Click "Increment" a few times, then watch "Last logged": it stays frozen ' +
      'at whatever count existed on mount, even though the count on screen keeps ' +
      'climbing.',
  },
  {
    id: 'layout-effect-flicker',
    title: 'useEffect instead of useLayoutEffect for a paint-blocking measurement',
    matrixId: 'W3-D4-04',
    summary:
      'The quote wizard’s sticky premium summary measures its local header’s ' +
      'rendered height to know where to dock. With this on, that measurement ' +
      'moves from useLayoutEffect (runs before the browser paints) to useEffect ' +
      '(runs after), so the very first paint happens with the pre-measurement ' +
      'fallback offset.',
    symptom:
      'Go to /quote with this toggle on: the sticky premium bar visibly starts ' +
      'at the top of the page and jumps down to its docked position a frame ' +
      'later, instead of appearing already docked. No inline sandbox here — ' +
      'the effect lives in the real StickyPremiumSummary component, not a ' +
      'stand-in, so the wizard route is the demo.',
  },
  {
    id: 'risk-feed-outage',
    title: 'Third-party risk feed outage',
    matrixId: 'W3-D4-03',
    summary:
      'Points the risk-exposure widget on /policies/:id at api.ts’s ' +
      'fetchRiskFeed endpoint, which rejects on every call by design. The ' +
      'rejected promise is read with use(), so it surfaces as a throw during ' +
      'render — not as an error state a component branches on.',
    symptom:
      'Open any policy with this on. The risk widget shows a skeleton, then a ' +
      'red fallback with a Retry button; the policy header, coverage table and ' +
      'tab nav around it keep rendering untouched. That containment is the ' +
      'point — this is the only defect in the list whose "symptom" is that ' +
      'the rest of the page does NOT break. Press Retry: it evicts the cached ' +
      'rejection and remounts, so it genuinely re-requests (watch for a second ' +
      '`[api] →` line) and then fails again, because the endpoint is down for ' +
      'good. A Retry that silently did nothing would look identical on screen ' +
      'without the console.',
  },
  {
    id: 'claim-submit-failure',
    title: 'Claim submission forced to fail',
    matrixId: 'C-05',
    summary:
      'PolicyClaimsTab passes forceFailure: true to api.ts’s submitClaim ' +
      'whenever this is on, so the underwriting gateway rejects the write ' +
      'regardless of what was actually filled in — the same forced rejection ' +
      'submitClaim has supported since Phase 0, finally with a caller.',
    symptom:
      'Open any policy → Claims tab → "Log claim", fill in a valid amount and ' +
      'description, submit. The row appears in the table immediately, ' +
      'labelled "Submitting…" — that is the useOptimistic update, before the ' +
      'simulated 400–900ms round trip has even resolved. With this toggle on, ' +
      'the row then disappears again a moment later (the optimistic entry ' +
      'rolls back because the real submitClaim call never succeeds) and a ' +
      'toast reports the rejection. Turn the toggle off and submit the same ' +
      'form: the row appears the same way and this time it sticks, because ' +
      'the real write behind it succeeded.',
  },
];

const enabled = new Map<LabDefectId, boolean>(LAB_DEFECTS.map((defect) => [defect.id, false]));
const listeners = new Set<() => void>();

export function isLabEnabled(id: LabDefectId): boolean {
  return enabled.get(id) ?? false;
}

export function setLabEnabled(id: LabDefectId, next: boolean): void {
  enabled.set(id, next);
  for (const listener of listeners) listener();
}

export function subscribeLab(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
