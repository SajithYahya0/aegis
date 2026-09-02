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

Legend for **Done**:
- `[x]` — **solid.** The named code runs, is reachable from a route, and its
  mechanism can be observed doing something.
- `[~]` — **qualified.** The named code exists, is correct, and is reachable —
  but the thing it demonstrates is not observable in this app, or only part of
  the row's claim holds. The reason is stated inline on the row. See
  [Known weak claims](#known-weak-claims) for the honest count.
- `[ ]` — not built.

`[~]` was added after a full-repo audit found rows that satisfied every
mechanical check the old criteria stated — real file, real export, clickable
route — while demonstrating nothing. That gap in the criteria is itself the
finding: **a concept is only demonstrated if its mechanism can be observed
doing something.** Rows are not downgraded for being imperfect, only for being
inert or overstated, and none of them are fixed by inventing a consumer that
the app does not otherwise need — that would trade an honest gap for a
contrived usage, which `CLAUDE.md` ranks as strictly worse.

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
| W2-D1-01 | `useEffect` — mount-only fetch (`[]` deps) | R | Claims history load on `/policies/:id/claims` | `src/shared/hooks/useFetch.ts` — `useFetch`, used by `src/routes/policyDetail/PolicyClaimsTab.tsx`. **Qualified:** no `[]`-deps *fetch* exists anywhere in the app. A `[policyId]` effect runs once on first render, which is the mount case, but that is an argument for why the row need not be built separately — not a demonstration of it. Writing a literal `[]` fetch here would ship the bug the hook exists to prevent (POL-1's claims shown forever, because Router reuses the tab instance across `:id` changes), so the gap is left honest. `[]`-deps effects that are *not* fetches do exist and are solid: `useRenewalCountdown`'s interval (W2-D1-04) and `Modal`'s keydown listener | [~] |
| W2-D1-02 | `useEffect` — dependency-driven refetch | R | Refetch claims when `:id` changes | `src/shared/hooks/useFetch.ts` — `useFetch` (effect deps = caller's `deps`, e.g. `[policyId]`) | [x] |
| W2-D1-03 | `useEffect` — cleanup with `AbortController` | R | Cancel in-flight claims fetch on route change | `src/shared/hooks/useFetch.ts` — `useFetch` (`controller.abort()` in the cleanup) | [x] |
| W2-D1-04 | `useEffect` — cleanup of subscription/interval | R | Renewal countdown timer teardown | `src/shared/hooks/useRenewalCountdown.ts` — `useRenewalCountdown`, used by `src/routes/policyDetail/RenewalCountdown.tsx` | [x] |
| W2-D1-05 | Pitfall: infinite loop (object dep) | R | Registered lab defect — object literal in deps | `src/shared/labs/EffectDepsDemo.tsx` — `EffectDepsDemo` (built in Phase 1, reachable via the dev-only `LabPanel` mounted in `AppLayout` on every route — never actually claimed until this pass caught the gap) | [x] |
| W2-D1-06 | Pitfall: stale closure | R | Registered lab defect — interval reading stale count | `src/shared/labs/StaleClosureDemo.tsx` — `StaleClosureDemo` (same Phase 1 gap as W2-D1-05 — see note above) | [x] |
| W2-D1-07 | Effect vs derived state (when NOT to use effect) | R | Premium total derived in render, documented in header | `src/routes/QuoteWizardPage.tsx` — `estimateIndicativePremium`, called directly in the render body (no `useState`/`useEffect` pair) | [x] |
| W2-D2-01 | `useRef` — DOM node access & focus | R | Autofocus first field when claim modal opens | `src/shared/components/Modal.tsx` — `Modal` (`containerRef` + `focusFirst()`) | [x] |
| W2-D2-02 | `useRef` — mutable value, no re-render | R | Last-activity timestamp written at pointer frequency | `src/shared/hooks/useRenewalCountdown.ts` — `useRenewalCountdown` (`lastActivityRef`). The audit found `timerRef` alongside it was a ref where a closure `const` suffices — written once per effect run, read once per cleanup, by a closure that can already see the effect's own scope. **Removed**, not documented as inert: unlike the `[~]` rows below, this was redundant code rather than a correct mechanism with no observable effect. `lastActivityRef` earns the row on its own — as state it would re-render the whole detail page dozens of times a second while the mouse rests on it | [x] |
| W2-D2-03 | `useRef` — previous-value pattern | R | Premium delta indicator ("was ₹X") | `src/routes/quoteWizard/StickyPremiumSummary.tsx` — `StickyPremiumSummary` (`currentPremiumRef` / `previousPremiumRef`, written during render) | [x] |
| W2-D2-04 | `createContext` + Provider | R | `AuthContext` (current user + role) | `src/shared/store/AuthContext.tsx` — `AuthProvider` | [x] |
| W2-D2-05 | `useContext` consumption | R | Role-gated underwriter actions | `src/shared/routes/RequireRole.tsx` — `RequireRole` (`useAuth()`) | [x] |
| W2-D2-06 | Context split to limit re-renders (state vs dispatch) | R | `QuoteStateContext` / `QuoteDispatchContext` | `src/shared/store/QuoteContext.tsx` — `QuoteStateContext`, `QuoteDispatchContext`. **Qualified — inert:** the split is correct and saves zero renders here. Every consumer (`WizardNav`, `ApplicantStep`, `RiskStep`, `CoverageStep`, `ReviewStep`) reads *both* contexts through the single `useQuote()` hook, so there is no dispatch-only subscriber to spare. It would still save zero if one existed: `QuoteWizardPage` reads state and renders the steps inline, so a state change re-renders them as children regardless of which contexts they read (a dispatch-only consumer would need its own `useContext(QuoteDispatchContext)` rather than `useQuote()`, which the wizard has no use for) — cashing the split in additionally needs `React.memo` on the steps. Deliberately **not** fixed by inventing a dispatch-only component; see [Known weak claims](#known-weak-claims) | [~] |
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
| W3-D1-02 | `React.memo` with custom comparator | R | `PremiumBadge` comparing formatted value | `src/routes/policies/PremiumBadge.tsx` — `PremiumBadge`. **Qualified — inert, and arguably wrong even if it ran:** the comparator can never execute. `PremiumBadge` is rendered only by `PolicyRow`, which is itself memoised on a referentially stable `premium`, and a parent that bails out never renders its child. `docs/render-counts.md` measured this and says so. Worse, if it did run it would lose: the comparator calls `formatCurrency` twice to skip a render that calls it once — more expensive than not memoising, which is the exact argument W3-D1-06 makes one file away. The scenario it defends (two `rateBook` runs pricing a policy a paisa apart) cannot occur while `rateBook` runs once per session | [~] |
| W3-D1-03 | `useMemo` — genuinely expensive computation | R | Premium rating engine over full policy book | `src/routes/PoliciesPage.tsx` — `PoliciesPage` (`premiums = useMemo(() => rateBook(...), [filtered])`) | [x] |
| W3-D1-04 | `useMemo` — referential stability of context value | R | Auth + quote provider values | `src/shared/store/AuthContext.tsx` — `AuthProvider`. **Qualified — inert:** the memo's bail-out branch is unreachable in this tree. `role` is the provider's only state and nothing above `AuthProvider` re-renders, so `AuthProvider` re-renders exactly when `role` changes — which is exactly when the value must change anyway. The file's header states the general hazard ("every render hands consumers a brand-new object") as though it were a fact about this app; it is not. Kept because it is correct-by-construction the moment a second piece of state or a re-rendering ancestor appears, and because the `useCallback` on `switchRole` beside it *is* load-bearing | [~] |
| W3-D1-05 | `useCallback` — stable handler into memo child | R | `onSelect` passed to `PolicyRow` | `src/routes/PoliciesPage.tsx` — `handleSelect` | [x] |
| W3-D1-06 | When NOT to optimise (documented counter-example) | R | `docs/failure-modes.md` + header note on a deliberately un-memoised leaf | `src/routes/policies/FilterStatus.tsx` — `FilterStatus` (header note; the `docs/failure-modes.md` companion table is Phase 5's, per `docs/phase-prompts.md`) | [x] |
| W3-D2-01 | Rules of hooks (violation demonstrated) | R | Registered lab defect: conditional hook call | `src/shared/labs/ConditionalHookDemo.tsx` — `ConditionalHookDemo` | [x] |
| W3-D2-02 | Custom hook — `useLocalStorage` | R | Recently-viewed policies list on /policies | `src/shared/hooks/useLocalStorage.ts` — `useLocalStorage`, used by `src/routes/PoliciesPage.tsx` | [x] |
| W3-D2-03 | Custom hook — `useDebounce` | R | Policy search input | `src/shared/hooks/useDebounce.ts` — `useDebounce`, used by `src/shared/hooks/usePolicyFilters.ts` | [x] |
| W3-D2-04 | Custom hook — `useFetch` | R | Claims history loader | `src/shared/hooks/useFetch.ts` — `useFetch`, used by `src/routes/policyDetail/PolicyClaimsTab.tsx` (not one of Phase 3's own target rows, but built as part of it and genuinely reachable — closing it now rather than leaving it stale) | [x] |
| W3-D2-05 | Custom hook — composition (hook using hooks) | R | `usePolicyFilters` = search params + debounce + memo | `src/shared/hooks/usePolicyFilters.ts` — `usePolicyFilters` | [x] |
| W3-D2-06 | Testing a custom hook | R | `useDebounce.test.ts`, `useLocalStorage.test.ts` (fake timers) | `src/shared/hooks/useDebounce.test.ts`, `src/shared/hooks/useLocalStorage.test.ts` | [x] |
| W3-D2-07 | Testing a component | R | `PolicyList.test.tsx` — filter narrows rows | `src/routes/policies/PolicyList.test.tsx` | [x] |
| W3-D3-01 | `React.lazy` — route-level splitting | R | All top-level routes | `src/shared/routes/lazyRoutes.tsx` — `splitChunk` + the seven top-level route exports, consumed by `src/App.tsx`'s `BoundedRoute`; separate chunks confirmed in `vite build` output, and every route walked at runtime by `src/App.test.tsx` | [x] |
| W3-D3-02 | `React.lazy` — component-level splitting | R | Claim intake wizard (heavy, modal-only) | `src/routes/ClaimIntakePage.tsx` — module-scope `splitChunk('ClaimIntakeWizard', () => import('./claimIntake/ClaimIntakeWizard'))`, rendered only inside an open `<Modal>`. The `import()` stays in this file (it is what draws the chunk boundary); only the memoise/log/reset mechanism is shared with the route chunks — which is how its Retry got fixed alongside theirs. Verified twice: its own chunk in `vite build`, and *not* loaded while the modal is closed by `src/App.test.tsx` | [x] |
| W3-D3-03 | `<Suspense>` fallback | R | Per-route boundary | `src/App.tsx` — `LazyRoute` (one `<Suspense>` per route **and** per `/policies/:id` tab); also `src/routes/PolicyDetailPage.tsx`, `src/routes/policyDetail/RiskExposureWidget.tsx`, `src/routes/ClaimIntakePage.tsx` | [x] |
| W3-D3-04 | Skeleton UI while chunk loads | R | `Skeleton.tsx` variants | `src/shared/components/Skeleton.tsx` — `Skeleton` (`table` / `card` / `panel`) | [x] |
| W3-D3-05 | Preloading on intent (hover/focus) | R | Sidebar nav preloads route chunk | `src/shared/routes/lazyRoutes.tsx` — `preloadPath` / `SplitChunk.preload`, wired to `onMouseEnter` **and** `onFocus` in `src/shared/layout/AppLayout.tsx`; logs `[chunk] ↓ … (preload)` then `⤳ … already requested (render)`. The memoisation those two lines depend on is asserted in `src/shared/routes/lazyRoutes.test.tsx` — two preloads plus a render must call the loader once | [x] |
| W3-D4-01 | Error Boundary class component | R | `ErrorBoundary.tsx` — `getDerivedStateFromError` + `componentDidCatch` | `src/shared/components/ErrorBoundary.tsx` — `ErrorBoundary`; tested in `src/shared/components/ErrorBoundary.test.tsx` | [x] |
| W3-D4-02 | Boundary retry that actually recovers (key bump) | R | Retry remounts children via key | `src/shared/components/ErrorBoundary.tsx` — `handleRetry` + `<Fragment key={attempt}>`, paired with `onRetry` at every call site. **Was measurably false, now repaired** — this row was flagged for downgrade and instead fixed, because the fix was available. The old claim was that the `key` bump clears `React.lazy`'s memoised rejection; it does not (a probe recorded one import attempt before Retry and one after), so `App.tsx`'s route-level Retry could never recover a failed chunk and `ClaimIntakePage`'s had the same hole. Fixed by `splitChunk().reset()` in `src/shared/routes/lazyRoutes.tsx`, wired through `App.tsx`'s `BoundedRoute` and `ClaimIntakePage`. Now three mechanisms, all tested: the remount and the eviction ordering in `ErrorBoundary.test.tsx`, the lazy reset in `src/shared/routes/lazyRoutes.test.tsx` — including a negative test that fails if remounting ever starts recovering on its own. `ErrorBoundary.tsx`'s header carries the correction | [x] |
| W3-D4-03 | Scoped boundary — widget fails, page survives | R | Claims widget throws; policy detail still renders | `src/routes/policyDetail/RiskExposureWidget.tsx` — `RiskExposurePanel`, wired to `api.ts`'s always-rejecting `fetchRiskFeed` behind the `risk-feed-outage` lab toggle. **Deliberate deviation:** the failing widget is the risk feed, not the Claims tab. Making Claims the one that throws would mean converting it from the `useFetch` + `AbortController` path to the `use()` + Suspense path, and CLAUDE.md requires both paths to exist *and* to be contrastable — they now sit on the same page, one tab apart. `fetchRiskFeed` was built in Phase 0 for exactly this row (see its header) | [x] |
| W3-D4-04 | `useLayoutEffect` vs `useEffect` (flicker shown) | R | Sticky premium summary measuring header height | `src/routes/quoteWizard/StickyPremiumSummary.tsx` — `StickyPremiumSummary`, toggled by the `layout-effect-flicker` lab defect (`src/shared/labs/registry.ts`). **Qualified — the flicker is no longer shown:** the mechanism is correct and both branches still run, but the bar was moved from `position: fixed` to `position: sticky` on product feedback (it should travel with the wizard and pin on arrival, not hang over it). `top` on a sticky element is a scroll-triggered clamp, and this four-step wizard never scrolls far enough to reach it, so the measured-vs-fallback difference lands in `dockTop` but is never drawn — both branches paint the bar at the same in-flow position. What still demonstrates the row is the console: the `before paint` / `after paint` tag on each log line, which is the guarantee itself rather than a proxy for it. Deliberately **not** fixed by reverting the CSS to suit the demo; see [Known weak claims](#known-weak-claims) | [~] |
| W3-D4-05 | `forwardRef` | R | `Modal`, `TextField` | `src/shared/components/Modal.tsx` — `Modal` (`TextField` deliberately does not need `forwardRef` — see its own header; nothing in the app grabs its DOM node directly, `Modal`'s generic `querySelectorAll` focus search covers it) | [x] |
| W3-D4-06 | `useImperativeHandle` — exposed API | R | `modalRef.current.open()/close()/focusFirst()` | `src/shared/components/Modal.tsx` — `Modal`, consumed via `modalRef` in `src/routes/policyDetail/PolicyClaimsTab.tsx` | [x] |
| W3-D5-01 | `use()` — unwrapping a promise | R | Policy detail data | `src/routes/policyDetail/PolicySummaryCard.tsx` — `PolicySummaryCard` (`use(getPolicyResource(policyId))`, no loading/error state of its own) | [x] |
| W3-D5-02 | Suspense for data + cached promise (no fetch loop) | R | `api.ts` promise cache keyed by policy id | `src/shared/api.ts` — `getPolicyResource` / `clearPolicyResource`, consumed by `PolicySummaryCard` and `RiskExposureWidget`. Proved in the console: one `[api] →` per policy per session against many `[api] ⤳ cache hit` + `[render] PolicySummaryCard` pairs | [x] |
| W3-D5-03 | `use()` with Context (conditional read) | R | Theme/role read inside a branch | `src/routes/policyDetail/PolicySummaryCard.tsx` — `use(AuthContext)` inside the `lapsed`/`cancelled` branch, so an active policy never subscribes to auth at all. `AuthContext` is exported from `src/shared/store/AuthContext.tsx` specifically for this | [x] |
| W3-D5-04 | Suspense + ErrorBoundary together | R | Rejected promise caught by boundary | `src/routes/policyDetail/RiskExposureWidget.tsx` — `RiskExposurePanel` (ErrorBoundary → Suspense → `use()` on a promise that is pending then rejected); same pairing in `src/App.tsx`'s `LazyRoute` and `src/routes/PolicyDetailPage.tsx` | [x] |
| W3-D5-05 | Refactor prior routes to lazy-load | R | Whole route table | `src/App.tsx` — `App`; all seven top-level routes **and** the three `/policies/:id` tabs are lazy. Walked at runtime by `src/App.test.tsx` | [x] |

---

## Completeness tier — remaining React 19 hooks & APIs

| ID | Concept | Tier | Feature that forces it | File / Export | Done |
|---|---|---|---|---|---|
| C-01 | `useId` | C | Repeated insured-party fieldsets — label/input pairing | `src/shared/components/TextField.tsx` — `TextField`, used per-row in the insured-party fieldset in `src/routes/QuoteWizardPage.tsx`'s `ApplicantStep` | [x] |
| C-02 | `useTransition` | C | Switching policy-book tabs without blocking input | `src/routes/PoliciesPage.tsx` — `handleViewChange` (`useTransition`), with `isPending` surfaced by `src/routes/policies/PolicyBookTabs.tsx` and the view whose render cost justifies it in `src/routes/policies/ExposureByCustomer.tsx` | [x] |
| C-03 | `useDeferredValue` | C | Large filtered list lags behind search box | `src/shared/hooks/usePolicyFilters.ts` — `usePolicyFilters` (`deferredQuery`) | [x] |
| C-04 | `useSyncExternalStore` | C | Online/offline sync banner | `src/shared/components/ConnectivityBanner.tsx` — `ConnectivityBanner` (module-level `subscribe`/`getSnapshot`/`getServerSnapshot`, read with `useSyncExternalStore` in the component), mounted once in `src/shared/layout/AppLayout.tsx` so it is reachable from every route. **On `labs/registry.ts`:** that module is exactly as legitimate a candidate for this row as `window`'s `online`/`offline` events — plain module state with a `subscribe`/`notify` pair, external to React, read via `useLabFlag`'s own `useState` + `useEffect` bridge instead of `useSyncExternalStore`. It is deliberately left alone rather than rewritten to claim this row, for two reasons. First, the named feature this row asks for is the connectivity banner specifically (see "Feature that forces it" above), and `ConnectivityBanner` already builds that honestly — rewriting `useLabFlag` in addition would be a second, redundant claim on the same row, not a stronger one. Second, `useLabFlag` is working infrastructure that five other lab defects (`W2-D1-05`, `W2-D1-06`, `W2-D3-02`, `W3-D2-01`, `W3-D4-04`, `W3-D4-03`) and the C-05 toggle all depend on; changing it now would be a rewrite made for the matrix's benefit rather than the app's, which CLAUDE.md rules out ("a contrived usage is worse than an honest gap"). `useLabFlag`'s own header already documents why it exists as a `useState`+`useEffect` bridge rather than `useSyncExternalStore`. | [x] |
| C-05 | `useOptimistic` | C | Claim status flips to "Submitting" before server confirms | `src/routes/policyDetail/PolicyClaimsTab.tsx` — `PolicyClaimsTab` (`useOptimistic` wraps `claims`; `addOptimisticClaim` called from `handleLogClaim` before `submitClaim` resolves). Forced-failure lab toggle: `claim-submit-failure` in `src/shared/labs/registry.ts`, read via `isLabEnabled` at submit time. **Deliberately not in `ClaimIntakeWizard`**, even though an earlier header in that file grouped all three React 19 form hooks together — see that file's current header for why: `useOptimistic` needs a list already on screen to show a pending entry in, and the wizard is a modal with no list, while `PolicyClaimsTab` has the real claims table sitting right there. | [x] |
| C-06 | `useActionState` | C | Claim submit action with returned error state | `src/routes/claimIntake/ClaimIntakeWizard.tsx` — `ClaimIntakeWizard` (review step's `<form action={submitAction}>`; validation-ahead-of-submit, so the returned state carries the async write's own error) **and** `src/routes/policyDetail/PolicyClaimsTab.tsx` — `ClaimForm` (single-step form; the action reads `amount`/`description` straight from `FormData` and returns real per-field errors, rendered through `TextField`'s existing `error` prop). Two call sites on purpose: the wizard shows the "validate ahead, one error slot" shape, the quick-claim form shows the "validate from FormData, per-field errors" shape — the same hook used two genuinely different ways rather than one usage copy-pasted twice. | [x] |
| C-07 | `useFormStatus` (react-dom) | C | Submit button disabled/pending inside the form | `src/shared/components/SubmitButton.tsx` — `SubmitButton`. **Qualified — one of the two call sites is unobservable.** `ClaimIntakeWizard` (review step) is the real one: `ClaimIntakePage.handleSubmit` awaits `submitClaim` *before* closing the modal, so the wizard stays mounted for the full 400–900ms round trip and `SubmitButton`/`WizardNavButton` genuinely render their pending state. `PolicyClaimsTab`'s `ClaimForm` does not: `handleLogClaim` calls `modalRef.current?.close()` on its first line, before the `await`, so the whole `<form>` — `SubmitButton` and `FormCancelButton` with it — unmounts before `pending` can ever render. Not "fixed" by reordering: closing immediately is the correct UX there, because the optimistic row in the table below (C-05) *is* the feedback and a lingering modal would cover it. The two features are in genuine tension and the hook loses; that is recorded rather than papered over | [~] |
| C-08 | `useDebugValue` | C | Label inside `useLocalStorage` for DevTools | `src/shared/hooks/useLocalStorage.ts` — `useLocalStorage` (built in Phase 2, whose own header already named C-08 — another pass where the matrix row itself was never updated to match; caught in this phase's audit alongside W2-D1-05/06) | [x] |
| C-09 | `createPortal` | C | Modal + toast rendered outside the DOM subtree | `src/shared/components/Modal.tsx` — `Modal`, `src/shared/components/Toast.tsx` — `Toast` (both portal to `#modal-root`, declared in `index.html`) | [x] |
| C-10 | `flushSync` | C | Scroll-to-new-row immediately after append | `src/routes/policyDetail/PolicyClaimsTab.tsx` — `handleLogClaim` (`flushSync` around the append, then `lastRowRef.current.scrollIntoView(...)`) | [x] |
| C-11 | `startTransition` (standalone) | C | Non-urgent filter commit outside a component | `src/shared/hooks/usePolicyFilters.ts` — `usePolicyFilters` (wraps the debounced `setSearchParams` commit, called from an effect rather than an input handler) | [x] |
| C-12 | `memo` + `useMemo` interaction proof | C | Render-count table in `docs/failure-modes.md` | `docs/render-counts.md` — measured, not estimated: console output captured from a real `PoliciesPage` mount plus four search-box keystrokes (`npx vitest run` against a temporary probe, deleted after the numbers were recorded). Evidence lives in `src/routes/policies/PolicyRow.tsx` (`React.memo`), `src/shared/rating.ts` (`useMemo`-wrapped `rateBook`, invoked from `src/routes/PoliciesPage.tsx`), and `src/routes/policies/FilterStatus.tsx` (deliberately un-memoised, W3-D1-06 — the contrast baseline). | [x] |

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
| `src/shared/api.ts` | Abortable `fetch*` path **and** `getPolicyResource` cached-promise path; `fetchRiskFeed` always rejects | ~~W2-D1-01…03 and W3-D5-01…04, once a route consumes them~~ — **all claimed as of Phase 4**; `fetchRiskFeed` finally has its consumer |
| `src/shared/format.ts` | Cached `Intl` formatters | W3-D1-02, once `PremiumBadge`'s comparator compares formatted output |
| `src/styles/global.css` | Reset + tokens; CSS Module conventions documented | W1-12, once a module composes a conditional status class |
The Phase 0 boot shell's `useMemo` around `rateBook` is **not** W3-D1-03. That
row needs a keystroke to make the cost observable, and it belongs to
/policies in Phase 2. `src/App.tsx` itself no longer belongs in this table —
Phase 1 replaced its body with the route table and it now claims W2-D4-02
directly (see the Week 2 section above).

---

## Known weak claims

**Total rows: 83. Solid `[x]`: 77. Qualified `[~]`: 6. Not built: 0.**

The previous line here read "Complete: 83. Remaining: 0", and that number was
defensible only against criteria that turned out to be too weak. A post-Phase-5
audit re-checked every row against a harder question than "does the file exist
and can I click to it" — *can the mechanism be observed doing anything?* — and
five rows failed it. They are listed below with what would make each solid.

None of the five is a missing feature, and none is fixed here by adding one.
Four are correct code whose effect is unobservable in this app; the fifth is a
concept the app has no honest home for. `CLAUDE.md` ranks a contrived usage as
worse than an honest gap, so **inert is recorded as inert**.

A **sixth** row joined them later, and it arrived differently from the other
five. W3-D4-04 was genuinely solid when it was written; it was downgraded when
a product change to `StickyPremiumSummary`'s positioning took its observable
away. That is worth separating out, because it is the case this table will keep
seeing: not a row that was never really demonstrated, but a row whose demo was
collateral damage from a change the app wanted for its own reasons. The rule
applied is the same one — the layout stays as the product asked, the row goes
to `[~]`, and the demo is not restored by bending the CSS back.

| ID | Concept | Why it is qualified | What would make it `[x]` |
|---|---|---|---|
| W3-D1-02 | `memo` custom comparator | `PremiumBadge`'s comparator can never run — its memoised parent bails out first, so the child is never rendered. Measured in `docs/render-counts.md`. And it would lose if it ran: two `formatCurrency` calls to skip a render costing one. | A second `rateBook` pass that re-prices the same policy. The app runs exactly one per session, so this needs a feature that does not exist. Alternatively: delete the comparator and let shallow compare on `amount` do the job — the more honest edit. |
| W2-D2-06 | Split context | No dispatch-only consumer exists; all five wizard steps read both, via `useQuote()`. Even one would re-render anyway, because `QuoteWizardPage` reads state and renders the steps as children. | `React.memo` on the step components **and** a step that genuinely needs dispatch without state. Neither is wanted by the wizard as designed. |
| W3-D1-04 | `useMemo` on a context value | `role` is `AuthProvider`'s only state and nothing above it re-renders, so the provider re-renders exactly when the value must change. The bail-out branch is unreachable. | A second piece of state in `AuthProvider`, or an ancestor that re-renders. Both would be invented for the matrix. |
| C-07 | `useFormStatus` | Real in `ClaimIntakeWizard`. Unobservable in `PolicyClaimsTab`'s `ClaimForm`: `handleLogClaim` closes the modal before its `await`, unmounting the form before `pending` can render. | Keeping the modal open until the action settles — which would cover the optimistic row (C-05) that is the actual feedback. The two features are in real tension; the hook loses. |
| W3-D4-04 | `useLayoutEffect` vs `useEffect` | The measurement, both effect branches and the `before paint` / `after paint` logs are all real and all still run. What is gone is the *visible* flicker: `.bar` moved from `position: fixed` to `position: sticky` so it scrolls with the wizard, and a sticky element's `top` is a scroll-triggered clamp this four-step wizard never scrolls far enough to trigger. A Playwright probe against the earlier sticky version recorded identical rendered rects with the toggle on and off, even though the two `top` values differed. | Enough content below the bar that the page actually scrolls past the dock offset — then `top` engages and the two branches diverge on screen again. A wizard step long enough to force that is a feature the quote flow does not want. Reverting to `fixed` would also do it, and is refused: it undoes the behaviour product asked for in order to make a demo look better. |
| W2-D1-01 | Mount-only fetch (`[]` deps) | No `[]`-deps *fetch* exists. `useFetch`'s `[policyId]` effect runs once on mount, but that is an argument for not building the row, not a demonstration of it. | A feature that genuinely fetches once and never refetches. Adding one to `PolicyClaimsTab` would ship the stale-data bug `useFetch` exists to prevent. |

### Repaired rather than downgraded

**W3-D4-02** was the sixth row this audit flagged, and it was the only one where
the claim was not merely inert but **measurably false**: `ErrorBoundary`'s header
asserted that the `key` bump clears `React.lazy`'s memoised rejection. A probe
rendering a rejecting `lazy()` inside the boundary recorded one import attempt
before Retry and one after — the loader was never re-entered, the fallback never
cleared. `App.tsx` compounded it by passing no `onRetry` at all, so every
route-level Retry button was decorative, as was the one in `ClaimIntakePage`'s
dialog.

It stays `[x]` because it was fixed rather than annotated: `splitChunk().reset()`
discards both the memoised promise and the rejected lazy component, wired at both
call sites, with `src/shared/routes/lazyRoutes.test.tsx` pinning it — including a
negative test that fails if remounting ever starts recovering on its own, and a
sabotage check confirming the positive test fails when `reset()` stops
re-creating the component. `ErrorBoundary.tsx`'s header now carries the
correction rather than the claim.

Two non-matrix bugs surfaced in the same pass and were fixed: `Toast` kept
`onDismiss` in its effect deps while both callers passed inline arrows, so the
auto-dismiss timer restarted on every parent render; and `useRenewalCountdown`
held its interval id in a ref where the effect's own closure already sufficed.

---

## Audit

Total rows: **83**. Solid: **77**. Qualified: **6**. Remaining: **0**.

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
>
> Phase 3 closed 18 rows: its full 16-row target list — W2-D1-01 through
> W2-D1-07, W2-D2-01 through W2-D2-03, W3-D4-04 through W3-D4-06, and C-01,
> C-09, C-10 — plus two bonus rows outside that list, W3-D2-04 and C-08. Of
> the 16 target rows, 14 needed real new code (`useFetch`,
> `useRenewalCountdown`, `Modal`, `Toast`, `TextField`,
> `StickyPremiumSummary`, the `estimateIndicativePremium` derived value, the
> claim-logging flow's `flushSync`); two (W2-D1-05, W2-D1-06) needed none —
> `EffectDepsDemo` and `StaleClosureDemo` were built in Phase 1 and have been
> reachable via the dev-only `LabPanel` on every route ever since, but no
> phase's audit had pointed the matrix at them. The `W3-D2-04` bonus
> (`useFetch`) was left open on purpose after Phase 2 pending the real
> consumer this phase built. The `C-08` bonus was the same kind of gap as
> W2-D1-05/06: `useLocalStorage` (Phase 2) already calls `useDebugValue` and
> its own header already named C-08, but the matrix row was never updated to
> match. See "Still unchecked after Phase 3" below for what is left.
>
> Phase 4 closed its full 14-row target list and nothing else: W3-D3-01
> through W3-D3-05, W3-D4-01 through W3-D4-03, W3-D5-01 through W3-D5-05,
> and C-02. No bonus rows, and no bookkeeping gaps found — Phase 3's audit
> had already swept those. Three of this phase's claims are backed by
> something stronger than a file path, because they are the kind that can be
> asserted without being true:
>
>   • **Splitting actually split.** `vite build` emits a separate chunk per
>     route plus a separate `ClaimIntakeWizard` chunk, and `rating.ts` moved
>     out of the entry chunk into `PoliciesPage`'s. Checked, not assumed —
>     and the check found one thing that did *not* move: `src/shared/data`
>     stays in the entry chunk, because `AppLayout` imports `AS_OF` from it
>     and a module reachable from a statically-imported component cannot be
>     lazily chunked. That is recorded in `lazyRoutes.tsx`'s header rather
>     than quietly omitted, because "the split did not help, and the reason
>     is one stray static import in shared chrome" is the most common way
>     this concept fails in practice.
>
>   • **The boundary retry actually recovers.** `ErrorBoundary.test.tsx`
>     covers both halves — the `key` bump remounting the child, and
>     `onRetry` firing *before* that remount. Writing it surfaced a React
>     behaviour worth knowing: a child that throws only on its first render
>     never reaches a boundary at all, because React discards a failed
>     concurrent render and immediately re-renders the root synchronously.
>     The test had to model a deterministic failure gated on external state,
>     which is also the more faithful model of a poisoned cache entry.
>
>   • **Every route still resolves.** `src/App.test.tsx` walks the route
>     table and asserts on content from inside each lazy chunk. This is the
>     automated form of the manual "click every route" check below, and it
>     matters more now than it did before: until this phase a broken route
>     import failed the build and could not ship. With lazy routes the same
>     mistake builds and deploys cleanly and breaks exactly one page —
>     whichever one nobody opened.
>
> One new lab defect was registered: `risk-feed-outage` (W3-D4-03), pointing
> the policy-detail risk widget at `fetchRiskFeed`. It is the only entry in
> `LAB_DEFECTS` whose symptom is that the *rest of the page keeps working*.
>
> Phase 5 closed its full 5-row target list — C-04 through C-07 and C-12 —
> and nothing else; every other row was already checked coming in. C-06 and
> C-07 land in two files rather than one: `ClaimIntakeWizard` (the review
> step's async submit, validated ahead of time) and `PolicyClaimsTab`'s
> `ClaimForm` (a single-step form validated from `FormData`, with real
> per-field errors). C-05 deliberately did NOT join them in
> `ClaimIntakeWizard`, despite that file's own header once grouping all three
> React 19 form hooks together — `useOptimistic` needs a list on screen to
> optimistically update, and only `PolicyClaimsTab` has one; forcing it into
> the wizard would have meant inventing a list nothing else there needs, the
> kind of contrived usage CLAUDE.md rules out. `ClaimIntakeWizard`'s header
> was rewritten to say so directly rather than silently diverging from its
> own prior plan. A new lab toggle, `claim-submit-failure`, was registered
> alongside the five existing ones so the C-05 rollback path is demonstrable
> on demand rather than only on bad luck. C-04 was built as the connectivity
> banner per this phase's brief; `labs/registry.ts` was left as-is — see that
> row's own entry above for why, and note in its own header now points back
> here.
>
> One bookkeeping correction while auditing this pass: C-06/C-07's target
> feature ("Claim submit action with returned error state" / "Submit button
> disabled/pending inside the form") does not name a specific file the way
> most rows do, so both plausible homes were built rather than picking one
> and leaving the other's submit flow on its pre-19 `useState` shape. Neither
> is a contrived add-on: `ClaimIntakeWizard`'s submit and `PolicyClaimsTab`'s
> quick-claim submit were both real, already-shipped forms with real
> `submitting`/`formError` state before this phase; this phase replaced that
> state with the React 19 hooks that do the same job, in both places, rather
> than inventing a new form for the sake of the row.

---

## Still unchecked after Phase 5

**None unbuilt** — but see [Known weak claims](#known-weak-claims), added after
this section was written. Six of the 83 are now `[~]` rather than `[x]` — five
found by that audit, and W3-D4-04 downgraded later when the premium bar was
changed from `position: fixed` to `position: sticky` and the visible flicker
went with it.

The audit below was run against the criteria in force at the time: does the
named file exist, does it export what the row claims, is it reachable from a
route. Every row passed, and that was true. It was also not enough — five rows
satisfy all three and demonstrate nothing observable, and one (W3-D4-02) passed
while asserting something measurably false. Left here unedited, because the
gap between what this section checked and what the later pass checked is the
most useful thing in it.

### Full-repo reachability audit (Phase 5)

Every row's File/Export column was re-checked against the current source
tree: does the named file exist, does it export what the row claims, and is
it reachable from a route without editing code or flipping a compile-time
flag. Two categories of finding, both already folded into the table above
rather than left as a separate to-do list:

- **Bookkeeping gaps from earlier phases**, where the code was real and
  reachable but the matrix row had not been updated to point at it. All were
  caught and closed in earlier phases' own audits (W2-D1-05, W2-D1-06,
  C-08 — see the Phase 3 note above) — none turned up newly in this pass.
- **Dev-only reachability**: `LabPanel` (and therefore every `LAB_DEFECTS`
  toggle, including the new `claim-submit-failure`) is mounted only when
  `import.meta.env.DEV` is true (`AppLayout.tsx`). This is intentional — a
  production build should not ship a panel that flips live defects — and it
  is the same condition every other lab-gated row has always been checked
  under, not a new exception carved out for this phase.

No row is checked without a file that exists, an export that matches, and a
click-path from a route. The lazy-route tests in `App.test.tsx` cover the
top-level path for every route; the tab/modal/toggle-level reachability
(Claims tab's log-claim flow, the claim intake wizard's review step, the
lab panel's checkboxes) was walked by hand against the running dev server
and against the temporary render/optimistic probes described in
`docs/render-counts.md` and `docs/failure-modes.md`, both deleted after
their output was recorded.

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

---

## Still unchecked after Phase 3

19 rows, grouped by section:

- **W3-D3 (5):** W3-D3-01 through W3-D3-05 — route-level and component-level
  `React.lazy`, per-route `<Suspense>`, skeleton UI, hover/focus preloading.
  Nothing is code-split yet; every route import in `App.tsx` is still static.
- **W3-D4 (3 of 6):** W3-D4-01, W3-D4-02, W3-D4-03 — the class-component error
  boundary, its key-bump retry, and the scoped widget-level boundary. (The
  other three rows in this section — W3-D4-04, 05, 06 — closed this phase via
  `StickyPremiumSummary` and `Modal`.) There is no boundary anywhere in the
  tree yet, so `api.ts`'s `fetchRiskFeed` — built in Phase 0 specifically for
  this — still has no consumer.
- **W3-D5 (5):** W3-D5-01 through W3-D5-05 — the `use()` hook reading
  `getPolicyResource`'s cached promise, `use()` reading Context in a
  conditional branch, Suspense + ErrorBoundary together over a rejected
  promise, and refactoring the existing routes to lazy-load. `PolicyDetailPage`
  and its tabs still read straight from the synchronous in-memory index
  (`policiesById` etc.), not from `api.ts`'s promise-cache layer.
- **Completeness tier (6):** C-02, C-04, C-05, C-06, C-07, C-12 —
  `useTransition` (policy-book tab switching), `useSyncExternalStore`
  (online/offline banner), `useOptimistic` (claim submitted-then-reconciled),
  `useActionState` (claim submit action), `useFormStatus` (submit button),
  and the render-count write-up in `docs/failure-modes.md` (which does not
  exist yet — Phase 5 owns it). C-08 closed this phase as a bookkeeping fix —
  see the audit note above.

Every row in Phase 3's own target list (W2-D1-01…07, W2-D2-01…03, W3-D4-04…06,
C-01, C-09, C-10) closed, plus the W3-D2-04 and C-08 bonuses described above.
Everything else unchecked belongs to Phase 4 or Phase 5 per
`docs/phase-prompts.md`.
---

## Still unchecked after Phase 4

5 rows, all in the completeness tier, all owned by Phase 5:

- **C-04 — `useSyncExternalStore`.** The online/offline sync banner. Nothing in
  Phase 4 subscribes to an external store that React does not own. Note that
  `src/shared/labs/registry.ts` *is* exactly such a store — plain module state
  with a subscribe/notify pair — and `useLabFlag` currently bridges it with
  `useState` + `useEffect`. That is a real, honest candidate for this row, and
  it is deliberately not claimed yet: the named feature is the connectivity
  banner, and rewriting `useLabFlag` in this phase would have been a change to
  working infrastructure made for the matrix's benefit rather than the app's.
  Phase 5 should decide between the two rather than inherit an assumption.
- **C-05 — `useOptimistic`.** Claim status flipping to "Submitting" before the
  server confirms. `api.ts`'s `submitClaim` already takes a `forceFailure`
  option built for the rollback demo, and it still has no optimistic consumer.
- **C-06 — `useActionState`.** The claim submit action with returned error
  state. `ClaimIntakeWizard` deliberately ships with a plain `useState`
  submitting flag instead; that flag is the thing Phase 5 deletes.
- **C-07 — `useFormStatus`.** The submit button's pending state read from
  inside the form. Depends on C-06 landing first — `useFormStatus` reads from a
  parent `<form>`'s action, so it needs a form that has one.
- **C-12 — `memo` + `useMemo` interaction proof.** The render-count table in
  `docs/failure-modes.md`, which does not exist yet. Phase 5 owns that file.
  The evidence it needs is already produced at runtime by the `[render]` logs
  in `PolicyRow` / `PremiumBadge` and the bug write-up in `PoliciesPage`'s
  header; what is missing is the document, not the behaviour.

Every row in Phase 4's own target list (W3-D3-01…05, W3-D4-01…03, W3-D5-01…05,
C-02) closed, with no bonuses and no deferrals. Week 1, Week 2 and Week 3 are
now complete in full — 78 of 83 rows — and everything still open is a
completeness-tier row that Phase 5 owns per `docs/phase-prompts.md`.
