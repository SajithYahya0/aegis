# Claude Code — Phase Prompts

Run each phase in a **fresh session**. Context stays clean and each phase starts
by re-reading `CLAUDE.md` and `docs/coverage-matrix.md`.

Before Phase 0, place `CLAUDE.md` at the repo root and
`docs/coverage-matrix.md` in place.

After every phase: `npx vitest run`, then load the preview and click through the
routes touched in that phase. Do not start the next phase on a broken build.

---

## Phase 0 — Scaffold & data layer

```
Read CLAUDE.md and docs/coverage-matrix.md in full before writing anything.

Scaffold AEGIS — a Policy & Claims Console. React 19 + Vite 5 + TypeScript +
react-router-dom 6.26.2, CSS Modules, Vitest + jsdom + Testing Library. Pin the
versions listed in CLAUDE.md exactly.

Deliver in this phase only:

1. package.json, vite.config.ts, tsconfig.json, index.html, src/main.tsx with
   BrowserRouter (and nothing else routing-related), setupTests.ts.
2. src/shared/types.ts — Customer, Policy, Claim, Quote, Coverage, Role.
   Policy has: id, customerId, type (motor|health|property|life), status
   (active|lapsed|pending|cancelled), sumInsured, startDate, endDate,
   coverages[], claimIds[]. Claim has: id, policyId, type, amount, status
   (draft|submitted|underReview|approved|rejected), filedAt, description.
3. src/shared/data/ — seed data as plain TS. At least 120 policies across 40
   customers and 60 claims, generated deterministically (seeded, no Math.random
   at module scope). The volume matters: the memoisation and useDeferredValue
   work must be observably slow without it.
4. src/shared/rating.ts — a premium rating engine. Real arithmetic: base rate by
   type, age loading, claims-history loading, no-claim bonus, sum-insured band,
   tenure discount. Export ratePolicy(policy, customer, claims) and
   rateBook(policies, customers, claims). rateBook must be genuinely expensive
   over the full book — do not fake it with a busy-wait loop.
5. src/shared/api.ts — simulated async layer. Every function takes an optional
   AbortSignal and rejects with a DOMException on abort. Latency 400–900ms.
   Separately export a promise-cache layer for the use() hook path:
   getPolicyResource(id) returning a stable cached promise per id, so re-renders
   do not refetch. Include a failing endpoint used later by the error boundary.
6. Global CSS reset + CSS Module conventions. Dense, professional,
   information-first styling — this is an insurance back-office console, not a
   consumer app. Neutral palette, tabular layouts, clear status colours.

Every file gets the WHY THIS EXISTS / CONCEPTS / WITHOUT THIS header.

Do not build routes or components yet. Stop when `npm run dev` boots to an empty
shell and `npx vitest run` passes with zero tests.

Then update docs/coverage-matrix.md for any rows this phase completed and report
the count.
```

---

## Phase 1 — Routing skeleton & contexts

```
Read CLAUDE.md and docs/coverage-matrix.md.

Build the routing skeleton and global state. Target rows: W2-D2-04 through
W2-D3-04, W2-D4-01 through W2-D4-10, W3-D1-04, W3-D2-01.

1. App.tsx — route table only. No BrowserRouter here. No root Suspense.
   Routes: / (dashboard), /policies, /policies/:id with nested index Coverage +
   claims + documents child routes via <Outlet>, /quote (wizard), /claims/new,
   /underwriting (protected), * (NotFound).
2. Layout shell: sidebar NavLink nav with active styling, header, content
   region.
3. src/shared/store/AuthContext.tsx — current user + role (agent | underwriter),
   a role switcher in the header (this is a demo; make switching explicit and
   visible). Provider value wrapped in useMemo. useAuth() throws a clear error
   when used outside the provider.
4. src/shared/store/QuoteContext.tsx — useReducer driving a multi-step quote
   wizard. SPLIT into QuoteStateContext and QuoteDispatchContext, read through
   a single useQuote() hook returning [state, dispatch]. Use the reducer's
   third lazy-init argument to rehydrate a draft from localStorage.
5. RequireRole route wrapper — reads auth, uses useLocation to remember the
   attempted path, useNavigate(..., { replace: true }) to redirect.
6. src/shared/labs/ — the deliberate-defect registry with runtime toggles and a
   dev-only panel to flip them. Register (off by default): conditional hook call
   (W3-D2-01), mutating reducer state (W2-D3-02), object-literal effect
   dependency causing an infinite loop (W2-D1-05), stale closure in an interval
   (W2-D1-06). Each toggle must produce a visible, explainable symptom.

Placeholder page components are fine this phase — real content comes next.

Update the matrix. List rows still unchecked.
```

---

## Phase 2 — Policy list, filtering, performance

```
Read CLAUDE.md and docs/coverage-matrix.md.

Target rows: W1-01 through W1-14, W3-D1-01 through W3-D1-06, W3-D2-02 through
W3-D2-07, C-03, C-11.

1. /policies page: filter bar (text search, status select, type select, expiring
   -within toggle) with all filter state held in the URL via useSearchParams.
2. src/shared/hooks/useDebounce.ts — generic, timer-based, with cleanup.
3. src/shared/hooks/useLocalStorage.ts — lazy useState initialiser, JSON
   safety, useDebugValue label (C-08).
4. src/shared/hooks/usePolicyFilters.ts — composes useSearchParams + useDebounce
   + useMemo. This is the hook-composition example.
5. useDeferredValue so the (large, expensive) filtered list lags behind the
   input rather than blocking keystrokes. Show the deferred/urgent split
   visually — dim the list while it is stale.
6. PolicyRow wrapped in React.memo, with a render-count console.log. Handlers
   passed to it come from useCallback. Premium values come from a useMemo over
   rateBook.
7. PremiumBadge with a custom memo comparator.
8. Deliberately leave one small leaf component un-memoised and document in its
   header why memoising it would be pointless (W3-D1-06).
9. Tests: useDebounce (fake timers), useLocalStorage, PolicyList filter
   behaviour.

Console output on typing in the search box must make the memoisation story
obvious: memoised rows do not re-log, non-memoised ones do.

Update the matrix. List rows still unchecked.
```

---

## Phase 3 — Detail route, effects, refs, imperative UI

```
Read CLAUDE.md and docs/coverage-matrix.md.

Target rows: W2-D1-01 through W2-D1-07, W2-D2-01 through W2-D2-03, W3-D4-04
through W3-D4-06, C-01, C-09, C-10.

1. /policies/:id with nested tabs (Coverage / Claims / Documents) via <Outlet>
   and NavLink.
2. Claims tab: src/shared/hooks/useFetch.ts — useEffect + AbortController,
   refetch on :id change, cleanup aborts in flight requests. Log the abort so it
   is demonstrable.
3. Renewal countdown: setInterval in useEffect with teardown; timer id and
   last-activity timestamp held in useRef (mutable, no re-render). Include an
   idle-session detector built on the same refs.
4. Previous-value ref pattern, inline in StickyPremiumSummary — show premium
   delta versus previous quote.
5. Sticky premium summary panel that measures the header with useLayoutEffect.
   Add a lab toggle that switches it to useEffect so the flicker is visible.
6. Modal component: createPortal to a #modal-root node, forwardRef +
   useImperativeHandle exposing open() / close() / focusFirst(). Focus the first
   field via a DOM ref on open, restore focus to the trigger on close, trap Tab,
   close on Escape.
7. TextField with useId pairing label/input/error, used in repeated
   insured-party fieldsets so duplicate ids would otherwise collide.
8. flushSync when appending a claim row then scrolling it into view.

Update the matrix. List rows still unchecked.
```

---

## Phase 4 — Lazy loading, boundaries, Suspense for data

```
Read CLAUDE.md and docs/coverage-matrix.md.

Target rows: W3-D3-01 through W3-D3-05, W3-D4-01 through W3-D4-03, W3-D5-01
through W3-D5-05, C-02.

1. Convert every top-level route to React.lazy with default exports. Per-route
   <Suspense> boundaries — still no root boundary in App.tsx.
2. Component-level lazy: the claim intake wizard, loaded only when the modal
   opens.
3. Skeleton.tsx with table / card / panel variants matching real layout
   dimensions so there is no layout shift.
4. Preload route chunks on nav hover and focus. Log the preload.
5. ErrorBoundary class: getDerivedStateFromError + componentDidCatch, a fallback
   with a Retry button, and retry that bumps a key on the children wrapper —
   because the module registry and the promise cache both memoise failures, so
   clearing error state alone does not recover. Say exactly this in the header.
6. Scoped boundary: the claims widget can fail while the rest of policy detail
   keeps rendering. Wire it to api.ts's failing endpoint behind a lab toggle.
7. use() hook for policy detail data, reading the cached promise from api.ts.
   Prove the cache: log every actual network call and show re-renders do not
   trigger new ones.
8. use() reading Context inside a conditional branch — the thing hooks cannot do.
9. Suspense + ErrorBoundary together: rejected promise surfaces in the boundary.
10. useTransition on policy-book tab switching so the input stays responsive.

Update the matrix. List rows still unchecked.
```

---

## Phase 5 — Claim submission, React 19 form hooks, docs

```
Read CLAUDE.md and docs/coverage-matrix.md.

Target rows: C-04 through C-07, C-12, and every row still unchecked.

1. Claim submit built on useActionState — the action returns validation errors
   as state; render field errors from it.
2. useFormStatus in a child SubmitButton, showing pending without prop drilling.
3. useOptimistic — the claim appears in the list as "Submitting" immediately and
   reconciles or rolls back on failure. Add a lab toggle to force failure.
4. useSyncExternalStore — online/offline banner subscribing to window
   online/offline events. Include getServerSnapshot.
5. docs/failure-modes.md — one table row per matrix ID:
   Concept | What I implemented | What breaks without it | How to demonstrate it live.
   Written in "I implemented X, otherwise Y would happen" form.
6. docs/render-counts.md — measured before/after render counts for the memo and
   deferred-value work (C-12). Real numbers from the console, not estimates.
7. README.md — run instructions, route map, ordered demo script (the sequence to
   click through in front of a reviewer), and the lab toggle list with the
   symptom each produces.

Then run the full audit: re-read docs/coverage-matrix.md and, for every row,
confirm the named file exists, exports what is claimed, and is reachable from a
route. Report any row that is checked but not actually reachable.
```

---

## Phase 6 — Self-audit and interrogation prep

```
Read the whole repo, docs/coverage-matrix.md, and docs/failure-modes.md.

1. Report every matrix row that is unchecked, or checked but whose code is
   unreachable, contrived, or would not survive the question "why is this here?"
   Be harsh. A contrived usage is a finding.
2. For each of these areas, write 5 hostile follow-up questions a senior
   reviewer would ask, with answers, into docs/qa-drills.md — collapsed
   (<details>) so it works as self-testing:
   memo/useMemo/useCallback; useEffect deps and cleanup; useRef vs state;
   Context re-render behaviour and the split-context decision; useReducer vs
   useState; lazy/Suspense boundary placement; error boundary retry semantics;
   useLayoutEffect vs useEffect; forwardRef/useImperativeHandle;
   use() vs useEffect fetching; useDeferredValue vs useTransition vs debounce;
   useSyncExternalStore; useOptimistic rollback.
   Include at least one question per area that attacks the decision rather than
   asking for a definition — e.g. "you could have solved this without X, so why
   is X here?"
3. Add docs/keyword-spine.md — one line per concept, keyword first, so the
   whole surface can be recalled from keywords alone.
```

---

## Running order today

| Phase | What it unlocks |
|---|---|
| 0 | Boots, data exists |
| 1 | Every route reachable, contexts live |
| 2 | The performance story is demonstrable |
| 3 | Effects, refs, imperative UI |
| 4 | Splitting, boundaries, Suspense data |
| 5 | Forms, external store, all docs |
| 6 | Audit + drills |

Phases 2 and 4 are the ones most likely to need a second pass. If time runs
short, cut styling polish — never cut Phase 6, because the drills are the part
you are actually being assessed on.
