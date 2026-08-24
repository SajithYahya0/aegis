# AEGIS — Concept Coverage Matrix

Every row is a concept drawn from the Week 1–3 reference material, plus a
"completeness" tier for hooks the reference implies but does not name. A row is
complete when the **File / Export** column names real running code and `Done` is
`[x]`.

Claude Code: update this file as you build. At the end of each phase, list every
row still unchecked.

Legend for **Tier**:
- **R** — named explicitly in the reference document. Non-negotiable.
- **C** — completeness tier. Not in the document, but the mentor asked for *all
  hooks*. Include all of these.

---

## Week 1 — Fundamentals

| ID | Concept | Tier | Feature that forces it | File / Export | Done |
|---|---|---|---|---|---|
| W1-01 | JSX syntax, expressions, fragments | R | Every component | `src/routes/policies/FilterStatus.tsx` — `FilterStatus` (`<>…</>` shorthand in both ternary branches) | [x] |
| W1-02 | Function components & composition | R | `PolicyRow` inside `PolicyList` inside `PoliciesPage` | `src/routes/policies/PolicyList.tsx` — `PolicyList` (renders `PolicyRow`, itself rendered by `PoliciesPage`) | [x] |
| W1-03 | Props, typed prop interfaces | R | `PolicyRow` receives `policy`, `onSelect` | `src/routes/policies/PolicyRow.tsx` — `PolicyRowProps` | [x] |
| W1-04 | `useState` — primitive state | R | Filter text input, modal open flag | `src/shared/hooks/usePolicyFilters.ts` — `usePolicyFilters` (`rawQuery`) | [x] |
| W1-05 | `useState` — object/array state + immutable update | R | Recently-viewed list update, dedupe + cap without mutation | `src/routes/PoliciesPage.tsx` — `handleSelect` | [x] |
| W1-06 | `useState` — functional updater form | R | Recently-viewed list update, depends on previous list | `src/routes/PoliciesPage.tsx` — `handleSelect` (`setRecentIds(prev => …)`) | [x] |
| W1-07 | `useState` — lazy initialiser `useState(() => …)` | R | `useLocalStorage` reading storage once on mount | `src/shared/hooks/useLocalStorage.ts` — `useLocalStorage` | [x] |
| W1-08 | List rendering with stable `key` | R | Policy list, claims table, coverage lines | `src/routes/policies/PolicyList.tsx` — `PolicyList` (`key={policy.id}`) | [x] |
| W1-09 | Conditional rendering (`&&`, ternary, early return) | R | Empty states, status badges, role-gated actions | `src/routes/PoliciesPage.tsx` (`&&`, recently-viewed panel), `src/routes/policies/FilterStatus.tsx` (ternary), `src/routes/policies/PolicyList.tsx` (early return, empty state) | [x] |
| W1-10 | Event handling & typed handlers | R | Filters, form submit, row click | `src/routes/policies/PolicyFilterBar.tsx` — `PolicyFilterBar` | [x] |
| W1-11 | Controlled inputs | R | Quote wizard fields | `src/routes/QuoteWizardPage.tsx` — `ApplicantStep`, `RiskStep`, `CoverageStep` | [x] |
| W1-12 | CSS Modules incl. one composed/conditional class | R | `PolicyRow.module.css` status colour by policy state | `src/routes/policies/PolicyRow.module.css` + `PolicyRow.tsx` — `STATUS_CLASS` | [x] |
| W1-13 | Lifting state up | R | Filter state owned by page, consumed by list + summary | `src/shared/hooks/usePolicyFilters.ts` (state), consumed by `src/routes/PoliciesPage.tsx` | [x] |
| W1-14 | Children / slot composition | R | `<Panel>` wrapper used across pages | `src/shared/components/Panel.tsx` — `Panel`, used twice in `src/routes/PoliciesPage.tsx` | [x] |

---

## Week 2 — Core Hooks, Context & Routing

| ID | Concept | Tier | Feature that forces it | File / Export | Done |
|---|---|---|---|---|---|
| W2-D1-01 | `useEffect` — mount-only fetch (`[]` deps) | R | Claims history load on `/policies/:id/claims` | | [ ] |
| W2-D1-02 | `useEffect` — dependency-driven refetch | R | Refetch claims when `:id` changes | | [ ] |
| W2-D1-03 | `useEffect` — cleanup with `AbortController` | R | Cancel in-flight claims fetch on route change | | [ ] |
| W2-D1-04 | `useEffect` — cleanup of subscription/interval | R | Renewal countdown timer teardown | | [ ] |
| W2-D1-05 | Pitfall: infinite loop (object dep) | R | Registered lab defect — object literal in deps | | [ ] |
| W2-D1-06 | Pitfall: stale closure | R | Registered lab defect — interval reading stale count | | [ ] |
| W2-D1-07 | Effect vs derived state (when NOT to use effect) | R | Premium total derived in render, documented in header | | [ ] |
| W2-D2-01 | `useRef` — DOM node access & focus | R | Autofocus first field when claim modal opens | | [ ] |
| W2-D2-02 | `useRef` — mutable value, no re-render | R | Idle-session timer id + last-activity timestamp | | [ ] |
| W2-D2-03 | `useRef` — previous-value pattern | R | Premium delta indicator ("was ₹X") | | [ ] |
| W2-D2-04 | `createContext` + Provider | R | `AuthContext` (current user + role) | `src/shared/store/AuthContext.tsx` — `AuthProvider` | [x] |
| W2-D2-05 | `useContext` consumption | R | Role-gated underwriter actions | `src/shared/routes/RequireRole.tsx` — `RequireRole` (`useAuth()`) | [x] |
| W2-D2-06 | Context split to limit re-renders (state vs dispatch) | R | `QuoteStateContext` / `QuoteDispatchContext` | `src/shared/store/QuoteContext.tsx` — `QuoteStateContext`, `QuoteDispatchContext` | [x] |
| W2-D2-07 | Custom hook wrapping context + guard throw | R | `useAuth()` throws outside provider | `src/shared/store/AuthContext.tsx` — `useAuth` | [x] |
| W2-D3-01 | `useReducer` — actions & dispatch | R | Quote wizard state machine | `src/shared/store/QuoteContext.tsx` — `quoteReducer` | [x] |
| W2-D3-02 | Reducer purity / immutable returns | R | Registered lab defect: mutating draft state | `src/shared/store/QuoteContext.tsx` — `quoteReducer` (`ADD_INSURED`, gated by `mutating-reducer`) | [x] |
| W2-D3-03 | `useReducer` lazy init (third arg) | R | Rehydrate quote draft from localStorage | `src/shared/store/QuoteContext.tsx` — `initQuoteDraft` | [x] |
| W2-D3-04 | `useReducer` + Context as lightweight global state | R | Quote provider consumed across wizard steps | `src/shared/store/QuoteContext.tsx` — `QuoteProvider`, consumed by `src/routes/QuoteWizardPage.tsx` | [x] |
| W2-D4-01 | `BrowserRouter` setup | R | `main.tsx` | `src/main.tsx` — `<BrowserRouter>` wrapping `<App/>` inside `<StrictMode>` in the `createRoot(...).render` call | [x] |
| W2-D4-02 | `Routes` / `Route` / index route | R | `App.tsx` | `src/App.tsx` — `App` | [x] |
| W2-D4-03 | Nested routes + `<Outlet>` | R | `/policies/:id` → Coverage \| Claims \| Documents tabs | `src/routes/PolicyDetailPage.tsx` — `PolicyDetailPage` | [x] |
| W2-D4-04 | `<Link>` / `<NavLink>` with active styling | R | Sidebar nav, detail tabs | `src/shared/layout/AppLayout.tsx` — `AppLayout` | [x] |
| W2-D4-05 | `useParams` | R | Policy id in detail route | `src/routes/PolicyDetailPage.tsx` — `PolicyDetailPage` | [x] |
| W2-D4-06 | `useNavigate` (incl. `replace`) | R | Redirect after claim submit; unauth redirect | `src/shared/routes/RequireRole.tsx` — `RequireRole` | [x] |
| W2-D4-07 | `useSearchParams` — filters in the URL | R | Policy list status/type/query params | `src/shared/hooks/usePolicyFilters.ts` — `usePolicyFilters` | [x] |
| W2-D4-08 | `useLocation` | R | Preserve attempted path across login redirect | `src/shared/routes/RequireRole.tsx` — `RequireRole` (writes), `src/routes/DashboardPage.tsx` — `DashboardPage` (reads) | [x] |
| W2-D4-09 | Protected / private route wrapper | R | `/underwriting` requires underwriter role | `src/shared/routes/RequireRole.tsx` — `RequireRole` | [x] |
| W2-D4-10 | 404 catch-all route | R | `*` → `NotFound` | `src/routes/NotFoundPage.tsx` — `NotFoundPage` | [x] |

---

## Week 3 — Advanced Hooks, Performance & Code Splitting

| ID | Concept | Tier | Feature that forces it | File / Export | Done |
|---|---|---|---|---|---|
| W3-D1-01 | `React.memo` | R | `PolicyRow` — measured with render logs | `src/routes/policies/PolicyRow.tsx` — `PolicyRow` | [x] |
| W3-D1-02 | `React.memo` with custom comparator | R | `PremiumBadge` comparing formatted value | `src/routes/policies/PremiumBadge.tsx` — `PremiumBadge` | [x] |
| W3-D1-03 | `useMemo` — genuinely expensive computation | R | Premium rating engine over full policy book | `src/routes/PoliciesPage.tsx` — `PoliciesPage` (`premiums = useMemo(() => rateBook(...), [filtered])`) | [x] |
| W3-D1-04 | `useMemo` — referential stability of context value | R | Auth + quote provider values | `src/shared/store/AuthContext.tsx` — `AuthProvider` | [x] |
| W3-D1-05 | `useCallback` — stable handler into memo child | R | `onSelect` passed to `PolicyRow` | `src/routes/PoliciesPage.tsx` — `handleSelect` | [x] |
| W3-D1-06 | When NOT to optimise (documented counter-example) | R | `docs/failure-modes.md` + header note on a deliberately un-memoised leaf | `src/routes/policies/FilterStatus.tsx` — `FilterStatus` (header note; the `docs/failure-modes.md` companion table is Phase 5's, per `docs/phase-prompts.md`) | [x] |
| W3-D2-01 | Rules of hooks (violation demonstrated) | R | Registered lab defect: conditional hook call | `src/shared/labs/ConditionalHookDemo.tsx` — `ConditionalHookDemo` | [x] |
| W3-D2-02 | Custom hook — `useLocalStorage` | R | Recently-viewed policies list on /policies | `src/shared/hooks/useLocalStorage.ts` — `useLocalStorage`, used by `src/routes/PoliciesPage.tsx` | [x] |
| W3-D2-03 | Custom hook — `useDebounce` | R | Policy search input | `src/shared/hooks/useDebounce.ts` — `useDebounce`, used by `src/shared/hooks/usePolicyFilters.ts` | [x] |
| W3-D2-04 | Custom hook — `useFetch` | R | Claims history loader | | [ ] |
| W3-D2-05 | Custom hook — composition (hook using hooks) | R | `usePolicyFilters` = search params + debounce + memo | `src/shared/hooks/usePolicyFilters.ts` — `usePolicyFilters` | [x] |
| W3-D2-06 | Testing a custom hook | R | `useDebounce.test.ts`, `useLocalStorage.test.ts` (fake timers) | `src/shared/hooks/useDebounce.test.ts`, `src/shared/hooks/useLocalStorage.test.ts` | [x] |
| W3-D2-07 | Testing a component | R | `PolicyList.test.tsx` — filter narrows rows | `src/routes/policies/PolicyList.test.tsx` | [x] |
| W3-D3-01 | `React.lazy` — route-level splitting | R | All top-level routes | | [ ] |
| W3-D3-02 | `React.lazy` — component-level splitting | R | Claim intake wizard (heavy, modal-only) | | [ ] |
| W3-D3-03 | `<Suspense>` fallback | R | Per-route boundary | | [ ] |
| W3-D3-04 | Skeleton UI while chunk loads | R | `Skeleton.tsx` variants | | [ ] |
| W3-D3-05 | Preloading on intent (hover/focus) | R | Sidebar nav preloads route chunk | | [ ] |
| W3-D4-01 | Error Boundary class component | R | `ErrorBoundary.tsx` — `getDerivedStateFromError` + `componentDidCatch` | | [ ] |
| W3-D4-02 | Boundary retry that actually recovers (key bump) | R | Retry remounts children via key | | [ ] |
| W3-D4-03 | Scoped boundary — widget fails, page survives | R | Claims widget throws; policy detail still renders | | [ ] |
| W3-D4-04 | `useLayoutEffect` vs `useEffect` (flicker shown) | R | Sticky premium summary measuring header height | | [ ] |
| W3-D4-05 | `forwardRef` | R | `Modal`, `TextField` | | [ ] |
| W3-D4-06 | `useImperativeHandle` — exposed API | R | `modalRef.current.open()/close()/focusFirst()` | | [ ] |
| W3-D5-01 | `use()` — unwrapping a promise | R | Policy detail data | | [ ] |
| W3-D5-02 | Suspense for data + cached promise (no fetch loop) | R | `api.ts` promise cache keyed by policy id | | [ ] |
| W3-D5-03 | `use()` with Context (conditional read) | R | Theme/role read inside a branch | | [ ] |
| W3-D5-04 | Suspense + ErrorBoundary together | R | Rejected promise caught by boundary | | [ ] |
| W3-D5-05 | Refactor prior routes to lazy-load | R | Whole route table | | [ ] |

---

## Completeness tier — remaining React 19 hooks & APIs

| ID | Concept | Tier | Feature that forces it | File / Export | Done |
|---|---|---|---|---|---|
| C-01 | `useId` | C | Repeated insured-party fieldsets — label/input pairing | | [ ] |
| C-02 | `useTransition` | C | Switching policy-book tabs without blocking input | | [ ] |
| C-03 | `useDeferredValue` | C | Large filtered list lags behind search box | `src/shared/hooks/usePolicyFilters.ts` — `usePolicyFilters` (`deferredQuery`) | [x] |
| C-04 | `useSyncExternalStore` | C | Online/offline sync banner | | [ ] |
| C-05 | `useOptimistic` | C | Claim status flips to "Submitting" before server confirms | | [ ] |
| C-06 | `useActionState` | C | Claim submit action with returned error state | | [ ] |
| C-07 | `useFormStatus` (react-dom) | C | Submit button disabled/pending inside the form | | [ ] |
| C-08 | `useDebugValue` | C | Label inside `useLocalStorage` for DevTools | | [ ] |
| C-09 | `createPortal` | C | Modal + toast rendered outside the DOM subtree | | [ ] |
| C-10 | `flushSync` | C | Scroll-to-new-row immediately after append | | [ ] |
| C-11 | `startTransition` (standalone) | C | Non-urgent filter commit outside a component | `src/shared/hooks/usePolicyFilters.ts` — `usePolicyFilters` (wraps the debounced `setSearchParams` commit, called from an effect rather than an input handler) | [x] |
| C-12 | `memo` + `useMemo` interaction proof | C | Render-count table in `docs/failure-modes.md` | | [ ] |

---

## Phase 0 — infrastructure that deliberately claims no rows

These files shipped in Phase 0 and are imported by running code, but they are
**not** counted against any matrix row, because no row's concept is yet visible
from a route the user can click to. Later phases claim them.

| File | Exists and works | Claims a row when… |
|---|---|---|
| `src/shared/types.ts` | Customer, Policy, Claim, Quote, Coverage, Role, PolicyDocument, InsuredParty | W1-03, once a typed prop interface is actually passed to `PolicyRow` |
| `src/shared/data/` | 40 customers, **140** policies, 60 claims, 463 documents, seeded, zero orphan references | W1-08, once a list renders them with a stable key |
| `src/shared/rating.ts` | `ratePolicy` / `rateBook`; full book prices in **21–42ms** warm | W3-D1-03, once /policies re-prices on a keystroke |
| `src/shared/api.ts` | Abortable `fetch*` path **and** `getPolicyResource` cached-promise path; `fetchRiskFeed` always rejects | W2-D1-01…03 and W3-D5-01…04, once a route consumes them |
| `src/shared/format.ts` | Cached `Intl` formatters | W3-D1-02, once `PremiumBadge`'s comparator compares formatted output |
| `src/styles/global.css` | Reset + tokens; CSS Module conventions documented | W1-12, once a module composes a conditional status class |
The Phase 0 boot shell's `useMemo` around `rateBook` is **not** W3-D1-03. That
row needs a keystroke to make the cost observable, and it belongs to
/policies in Phase 2. `src/App.tsx` itself no longer belongs in this table —
Phase 1 replaced its body with the route table and it now claims W2-D4-02
directly (see the Week 2 section above).

---

## Audit

Total rows: **83**. Complete: **46**. Remaining: **37**.

> Corrected in Phase 0: this line previously read "Total rows: 78", which did
> not match the file. Counted by section: W1 14, W2 28 (D1 7, D2 7, D3 4,
> D4 10), W3 29 (D1 6, D2 7, D3 5, D4 6, D5 5), completeness tier 12 — 83.
> The five-row discrepancy mattered: a phase that closed out "78 of 78" would
> have declared full coverage with five concepts still missing.
>
> Phase 1 closed 19 rows: W2-D2-04 through W2-D2-07, W2-D3-01 through
> W2-D3-04, W2-D4-02 through W2-D4-10 (W2-D4-01 was already done in Phase 0),
> W3-D1-04, W3-D2-01. See "Still unchecked after Phase 1" below for what is
> deliberately not claimed yet.
>
> Phase 2 closed 26 rows: W1-01 through W1-14 (all 14), W3-D1-01, 02, 03, 05,
> 06 (all of W3-D1 is now complete, W3-D1-04 having closed in Phase 1),
> W3-D2-02, 03, 05, 06, 07 (W3-D2-04 — `useFetch` — deliberately not claimed;
> the claims-history loader it belongs to is Phase 3's), and C-03, C-11. See
> "Still unchecked after Phase 2" below.

Final check before the review: open the app, click every route, and confirm each
row's file is actually reached. A row whose code exists but is never rendered
does not count.

---

## Still unchecked after Phase 1

63 rows, grouped by section:

- **W1 (14):** W1-01 through W1-14 — the whole fundamentals section. `/policies`
  is real enough to click through, but the list is unmemoised, unfiltered by
  anything beyond three plain controls, and has no `<Panel>` composition yet.
- **W2-D1 (7):** W2-D1-01 through W2-D1-07 — every effect-lifecycle row. The
  Claims and Documents tabs read straight from the in-memory index; there is no
  fetch, no abort, no interval yet, so none of these can be claimed honestly.
- **W2-D2 (3):** W2-D2-01, W2-D2-02, W2-D2-03 — the `useRef` trio. Nothing in
  Phase 1 needed a DOM ref, a mutable-without-render value, or a previous-value
  pattern.
- **W3-D1 (5):** W3-D1-01, 02, 03, 05, 06 — `React.memo`, its custom comparator,
  the expensive `useMemo` over `rateBook`, `useCallback`, and the deliberate
  non-optimisation. `PoliciesPage` renders a plain array today.
- **W3-D2 (6):** W3-D2-02 through W3-D2-07 — `useLocalStorage`, `useDebounce`,
  `useFetch`, `usePolicyFilters`, and both hook/component tests.
- **W3-D3 (5), W3-D4 (6), W3-D5 (5):** all of lazy loading, error boundaries,
  and Suspense-for-data. Nothing is code-split yet and there is no boundary
  anywhere in the tree.
- **Completeness tier (12):** C-01 through C-12 — none attempted yet.

None of these are gaps in Phase 1's own target list (W2-D2-04…W2-D3-04,
W2-D4-01…10, W3-D1-04, W3-D2-01) — that list closed in full. They are the
rows later phases own.

---

## Still unchecked after Phase 2

37 rows, grouped by section:

- **W2-D1 (7):** W2-D1-01 through W2-D1-07 — every effect-lifecycle row. The
  Claims and Documents tabs still read straight from the in-memory index; there
  is no fetch, no abort, no interval yet. Phase 2 did not touch
  `/policies/:id`.
- **W2-D2 (3):** W2-D2-01, W2-D2-02, W2-D2-03 — the `useRef` trio. Nothing on
  `/policies` needed a DOM ref, a mutable-without-render value, or a
  previous-value pattern; those all belong to the detail route.
- **W3-D2-04 (1):** `useFetch`. Deliberately not built this phase — its named
  feature is the claims-history loader on `/policies/:id`, which Phase 3 owns.
  Building it now against no real consumer would be exactly the kind of
  contrived usage CLAUDE.md rules out.
- **W3-D3 (5), W3-D4 (6), W3-D5 (5):** all of lazy loading, error boundaries,
  and Suspense-for-data. Nothing is code-split yet and there is no boundary
  anywhere in the tree.
- **Completeness tier (10):** C-01, C-02, C-04 through C-10, C-12 — C-03 and
  C-11 closed this phase; the rest depend on routes and forms Phase 2 does not
  touch (`useId` fieldsets, `useTransition` tab switching, `useOptimistic`
  claim submission, `createPortal`/`flushSync` for the modal, the render-count
  write-up in `docs/failure-modes.md`).

Every row in Phase 2's own target list (W1-01…14, W3-D1-01…06, W3-D2-02…07,
C-03, C-11) closed except W3-D2-04, which was excluded on purpose — see above.
Everything else unchecked belongs to a later phase per `docs/phase-prompts.md`.