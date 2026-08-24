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
| W1-01 | JSX syntax, expressions, fragments | R | Every component | | [ ] |
| W1-02 | Function components & composition | R | `PolicyRow` inside `PolicyList` inside `PoliciesPage` | | [ ] |
| W1-03 | Props, typed prop interfaces | R | `PolicyRow` receives `policy`, `onSelect` | | [ ] |
| W1-04 | `useState` — primitive state | R | Filter text input, modal open flag | | [ ] |
| W1-05 | `useState` — object/array state + immutable update | R | Claim intake form draft | | [ ] |
| W1-06 | `useState` — functional updater form | R | Renewal countdown tick, quantity stepper | | [ ] |
| W1-07 | `useState` — lazy initialiser `useState(() => …)` | R | `useLocalStorage` reading storage once on mount | | [ ] |
| W1-08 | List rendering with stable `key` | R | Policy list, claims table, coverage lines | | [ ] |
| W1-09 | Conditional rendering (`&&`, ternary, early return) | R | Empty states, status badges, role-gated actions | | [ ] |
| W1-10 | Event handling & typed handlers | R | Filters, form submit, row click | | [ ] |
| W1-11 | Controlled inputs | R | Quote wizard fields | | [ ] |
| W1-12 | CSS Modules incl. one composed/conditional class | R | `PolicyRow.module.css` status colour by policy state | | [ ] |
| W1-13 | Lifting state up | R | Filter state owned by page, consumed by list + summary | | [ ] |
| W1-14 | Children / slot composition | R | `<Panel>` wrapper used across pages | | [ ] |

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
| W2-D2-04 | `createContext` + Provider | R | `AuthContext` (current user + role) | | [ ] |
| W2-D2-05 | `useContext` consumption | R | Role-gated underwriter actions | | [ ] |
| W2-D2-06 | Context split to limit re-renders (state vs dispatch) | R | `QuoteStateContext` / `QuoteDispatchContext` | | [ ] |
| W2-D2-07 | Custom hook wrapping context + guard throw | R | `useAuth()` throws outside provider | | [ ] |
| W2-D3-01 | `useReducer` — actions & dispatch | R | Quote wizard state machine | | [ ] |
| W2-D3-02 | Reducer purity / immutable returns | R | Registered lab defect: mutating draft state | | [ ] |
| W2-D3-03 | `useReducer` lazy init (third arg) | R | Rehydrate quote draft from localStorage | | [ ] |
| W2-D3-04 | `useReducer` + Context as lightweight global state | R | Quote provider consumed across wizard steps | | [ ] |
| W2-D4-01 | `BrowserRouter` setup | R | `main.tsx` | `src/main.tsx` — `<BrowserRouter>` wrapping `<App/>` inside `<StrictMode>` in the `createRoot(...).render` call | [x] |
| W2-D4-02 | `Routes` / `Route` / index route | R | `App.tsx` | | [ ] |
| W2-D4-03 | Nested routes + `<Outlet>` | R | `/policies/:id` → Coverage \| Claims \| Documents tabs | | [ ] |
| W2-D4-04 | `<Link>` / `<NavLink>` with active styling | R | Sidebar nav, detail tabs | | [ ] |
| W2-D4-05 | `useParams` | R | Policy id in detail route | | [ ] |
| W2-D4-06 | `useNavigate` (incl. `replace`) | R | Redirect after claim submit; unauth redirect | | [ ] |
| W2-D4-07 | `useSearchParams` — filters in the URL | R | Policy list status/type/query params | | [ ] |
| W2-D4-08 | `useLocation` | R | Preserve attempted path across login redirect | | [ ] |
| W2-D4-09 | Protected / private route wrapper | R | `/underwriting` requires underwriter role | | [ ] |
| W2-D4-10 | 404 catch-all route | R | `*` → `NotFound` | | [ ] |

---

## Week 3 — Advanced Hooks, Performance & Code Splitting

| ID | Concept | Tier | Feature that forces it | File / Export | Done |
|---|---|---|---|---|---|
| W3-D1-01 | `React.memo` | R | `PolicyRow` — measured with render logs | | [ ] |
| W3-D1-02 | `React.memo` with custom comparator | R | `PremiumBadge` comparing formatted value | | [ ] |
| W3-D1-03 | `useMemo` — genuinely expensive computation | R | Premium rating engine over full policy book | | [ ] |
| W3-D1-04 | `useMemo` — referential stability of context value | R | Auth + quote provider values | | [ ] |
| W3-D1-05 | `useCallback` — stable handler into memo child | R | `onSelect` passed to `PolicyRow` | | [ ] |
| W3-D1-06 | When NOT to optimise (documented counter-example) | R | `docs/failure-modes.md` + header note on a deliberately un-memoised leaf | | [ ] |
| W3-D2-01 | Rules of hooks (violation demonstrated) | R | Registered lab defect: conditional hook call | | [ ] |
| W3-D2-02 | Custom hook — `useLocalStorage` | R | Claim draft autosave | | [ ] |
| W3-D2-03 | Custom hook — `useDebounce` | R | Policy search input | | [ ] |
| W3-D2-04 | Custom hook — `useFetch` | R | Claims history loader | | [ ] |
| W3-D2-05 | Custom hook — composition (hook using hooks) | R | `usePolicyFilters` = search params + debounce + memo | | [ ] |
| W3-D2-06 | Testing a custom hook | R | `useDebounce.test.ts`, `useLocalStorage.test.ts` (fake timers) | | [ ] |
| W3-D2-07 | Testing a component | R | `PolicyList.test.tsx` — filter narrows rows | | [ ] |
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
| C-03 | `useDeferredValue` | C | Large filtered list lags behind search box | | [ ] |
| C-04 | `useSyncExternalStore` | C | Online/offline sync banner | | [ ] |
| C-05 | `useOptimistic` | C | Claim status flips to "Submitting" before server confirms | | [ ] |
| C-06 | `useActionState` | C | Claim submit action with returned error state | | [ ] |
| C-07 | `useFormStatus` (react-dom) | C | Submit button disabled/pending inside the form | | [ ] |
| C-08 | `useDebugValue` | C | Label inside `useLocalStorage` for DevTools | | [ ] |
| C-09 | `createPortal` | C | Modal + toast rendered outside the DOM subtree | | [ ] |
| C-10 | `flushSync` | C | Scroll-to-new-row immediately after append | | [ ] |
| C-11 | `startTransition` (standalone) | C | Non-urgent filter commit outside a component | | [ ] |
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
| `src/App.tsx` | Phase 0 boot shell — **replaced** by the route table in Phase 1 | never; it is scaffolding |

The `useMemo` in the Phase 0 boot shell is **not** W3-D1-03. That row needs a
keystroke to make the cost observable, and it belongs to /policies in Phase 2.

---

## Audit

Total rows: **83**. Complete: **1**. Remaining: **82**.

> Corrected in Phase 0: this line previously read "Total rows: 78", which did
> not match the file. Counted by section: W1 14, W2 28 (D1 7, D2 7, D3 4,
> D4 10), W3 29 (D1 6, D2 7, D3 5, D4 6, D5 5), completeness tier 12 — 83.
> The five-row discrepancy mattered: a phase that closed out "78 of 78" would
> have declared full coverage with five concepts still missing.

Final check before the review: open the app, click every route, and confirm each
row's file is actually reached. A row whose code exists but is never rendered
does not count.