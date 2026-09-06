/**
 * WHY THIS EXISTS:
 *   The single list of deliberate defects and the store that tracks which are
 *   switched on. Plain module state with a subscribe/notify pair — not
 *   Context — because a defect like the conditional-hook demo has to read a
 *   toggle from inside a component that is deliberately breaking the rules of
 *   hooks, and a `useContext` call cannot be trusted to survive next to that.
 *
 * CONCEPTS: (infrastructure for W2-D1-05, W2-D1-06, W2-D3-02, W3-D2-01,
 *   W3-D4-03, W4-D3-04, C-05 — see the individual demo files, QuoteContext,
 *   PolicyClaimsTab and shared/http/mockBackend.ts for where each one fires)
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
  | 'risk-feed-outage'
  | 'claim-submit-failure'
  | 'expire-token';

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
      'PolicyClaimsTab sends forceFailure: true in the POST ' +
      '/policies/:id/claims body whenever this is on, so the mock backend ' +
      'answers 502 and the underwriting gateway rejects the write regardless ' +
      'of what was actually filled in — the same forced rejection api.ts’s ' +
      'submitClaim has supported since Phase 0, now travelling over the axios ' +
      'transport as a real HTTP status the error interceptor normalises.',
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
  {
    id: 'expire-token',
    title: 'Expire the access token',
    matrixId: 'W4-D3-04',
    summary:
      'The mock backend revokes whatever access token the next request ' +
      'presents and answers it 401, then switches this toggle back off. The ' +
      'response interceptor catches the 401, calls POST /auth/refresh once, ' +
      'and replays the original request with the new token — so the refresh ' +
      'flow is demonstrated live rather than described.',
    symptom:
      'Turn this on, then open any policy’s Claims tab (or switch to another ' +
      'policy’s). The claims still load — that is the point — but the console ' +
      'shows the whole recovery: "[api] ✕ GET /policies/…/claims 401 (lab: ' +
      'expire-token)", then "[auth] ↻ refreshing session", then "[api] → POST ' +
      '/auth/refresh", then "[http] ↻ replaying GET …" carrying the same ' +
      'req-NNNN correlation id as the attempt that failed. Nothing on screen ' +
      'reports an error, because nothing went wrong from the user’s side: one ' +
      'request took two round trips instead of one. Turn it on again and ' +
      'navigate between two policies quickly to see several requests hit the ' +
      'same expired token — there is still exactly one POST /auth/refresh, ' +
      'because concurrent 401s join the in-flight refresh instead of starting ' +
      'their own ("[auth] ⇢ joining the in-flight refresh").',
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
