# AEGIS — Concept Coverage Matrix

Every row is a concept drawn from the Week 1–4 reference material, plus a
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
| W2-D1-04 | `useEffect` — cleanup of subscription/interval | R | Idle-session poll on policy detail, torn down on unmount | `src/shared/hooks/useRenewalCountdown.ts` — `useRenewalCountdown`, used by `src/routes/policyDetail/RenewalCountdown.tsx`. The readout it feeds is days-only, so the once-a-second tick is owed entirely to `IDLE_THRESHOLD_MS` (30s) — going idle is the *absence* of events, which fires no event, so only a poll can notice it and only a sub-30s poll can notice it on time. That is what has to be torn down: one interval plus three `document`-level activity listeners, per policy opened | [x] |
| W2-D1-05 | Pitfall: infinite loop (object dep) | R | Registered lab defect — object literal in deps | `src/shared/labs/EffectDepsDemo.tsx` — `EffectDepsDemo` (built in Phase 1, reachable via the dev-only `LabPanel` mounted in `AppLayout` on every route — never actually claimed until this pass caught the gap) | [x] |
| W2-D1-06 | Pitfall: stale closure | R | Registered lab defect — interval reading stale count | `src/shared/labs/StaleClosureDemo.tsx` — `StaleClosureDemo` (same Phase 1 gap as W2-D1-05 — see note above) | [x] |
| W2-D1-07 | Effect vs derived state (when NOT to use effect) | R | Premium total derived in render, documented in header | `src/routes/QuoteWizardPage.tsx` — `estimateIndicativePremium`, called directly in the render body (no `useState`/`useEffect` pair) | [x] |
| W2-D2-01 | `useRef` — DOM node access & focus | R | Autofocus first field when claim modal opens | `src/shared/components/Modal.tsx` — `Modal` (`containerRef` + `focusFirst()`) | [x] |
| W2-D2-02 | `useRef` — mutable value, no re-render | R | Last-activity timestamp written at pointer frequency | `src/shared/hooks/useRenewalCountdown.ts` — `useRenewalCountdown` (`lastActivityRef`). The audit found `timerRef` alongside it was a ref where a closure `const` suffices — written once per effect run, read once per cleanup, by a closure that can already see the effect's own scope. **Removed**, not documented as inert: unlike the `[~]` rows below, this was redundant code rather than a correct mechanism with no observable effect. `lastActivityRef` earns the row on its own — as state it would re-render the whole detail page dozens of times a second while the mouse rests on it | [x] |
| W2-D2-03 | `useRef` — previous-value pattern | R | Premium delta indicator ("was ₹X") | `src/routes/quoteWizard/StickyPremiumSummary.tsx` — `StickyPremiumSummary` (`currentPremiumRef` / `previousPremiumRef`, written during render) | [x] |
| W2-D2-04 | `createContext` + Provider | R | Quote wizard draft; theme choice | `src/shared/store/QuoteContext.tsx` — `QuoteProvider` (two providers, `QuoteDispatchContext` outside `QuoteStateContext`), and `src/shared/theme/ThemeModeProvider.tsx` — `ThemeModeProvider`. **Rehomed, not weakened:** this row named `AuthContext.tsx` — `AuthProvider` until the session moved to Redux Toolkit (W4-D4-01) and that file was deleted. The two providers named here were already in the tree and already mounted in `main.tsx`; the row now points at the ones that are still the app's answer to "shared state without prop drilling" | [x] |
| W2-D2-05 | `useContext` consumption | R | Wizard steps read the quote draft; the AppBar reads the theme choice | `src/shared/store/QuoteContext.tsx` — `useQuote` (`useContext(QuoteStateContext)` + `useContext(QuoteDispatchContext)`), consumed by all five steps in `src/routes/QuoteWizardPage.tsx`; `src/shared/theme/ThemeModeProvider.tsx` — `useThemeChoice`, consumed by `src/shared/layout/AppShell.tsx`. **Rehomed:** was `RequireRole`'s `useAuth()`, which is now `useAppSelector` (W4-D4-01) | [x] |
| W2-D2-06 | Context split to limit re-renders (state vs dispatch) | R | `QuoteStateContext` / `QuoteDispatchContext` | `src/shared/store/QuoteContext.tsx` — `QuoteStateContext`, `QuoteDispatchContext`. **Qualified — inert:** the split is correct and saves zero renders here. Every consumer (`WizardNav`, `ApplicantStep`, `RiskStep`, `CoverageStep`, `ReviewStep`) reads *both* contexts through the single `useQuote()` hook, so there is no dispatch-only subscriber to spare. It would still save zero if one existed: `QuoteWizardPage` reads state and renders the steps inline, so a state change re-renders them as children regardless of which contexts they read (a dispatch-only consumer would need its own `useContext(QuoteDispatchContext)` rather than `useQuote()`, which the wizard has no use for) — cashing the split in additionally needs `React.memo` on the steps. Deliberately **not** fixed by inventing a dispatch-only component; see [Known weak claims](#known-weak-claims) | [~] |
| W2-D2-07 | Custom hook wrapping context + guard throw | R | `useQuote()` / `useThemeChoice()` throw outside their providers | `src/shared/store/QuoteContext.tsx` — `useQuote` ("must be called within a `<QuoteProvider>`"), `src/shared/theme/ThemeModeProvider.tsx` — `useThemeChoice`. **Rehomed:** was `useAuth`, which still exists under the same name in `src/shared/store/useAuth.ts` but now wraps `useAppSelector` — react-redux raises the missing-provider error itself, so the hand-rolled guard went with the Context | [x] |
| W2-D3-01 | `useReducer` — actions & dispatch | R | Quote wizard state machine | `src/shared/store/QuoteContext.tsx` — `quoteReducer` | [x] |
| W2-D3-02 | Reducer purity / immutable returns | R | Registered lab defect: mutating draft state | `src/shared/store/QuoteContext.tsx` — `quoteReducer` (`ADD_INSURED`, gated by `mutating-reducer`) | [x] |
| W2-D3-03 | `useReducer` lazy init (third arg) | R | Rehydrate quote draft from localStorage | `src/shared/store/QuoteContext.tsx` — `initQuoteDraft` | [x] |
| W2-D3-04 | `useReducer` + Context as lightweight global state | R | Quote provider consumed across wizard steps | `src/shared/store/QuoteContext.tsx` — `QuoteProvider`, consumed by `src/routes/QuoteWizardPage.tsx` | [x] |
| W2-D4-01 | `BrowserRouter` setup | R | `main.tsx` | `src/main.tsx` — `<BrowserRouter>` wrapping `<App/>` inside `<StrictMode>` in the `createRoot(...).render` call. The stack around it is `Provider store` → `ThemeModeProvider` → `BrowserRouter` → `QuoteProvider`, and `main.tsx`'s header argues each step from the one below it | [x] |
| W2-D4-02 | `Routes` / `Route` / index route | R | `App.tsx` | `src/App.tsx` — `App` | [x] |
| W2-D4-03 | Nested routes + `<Outlet>` | R | `/policies/:id` → Coverage \| Claims \| Documents tabs | `src/routes/PolicyDetailPage.tsx` — `PolicyDetailPage` | [x] |
| W2-D4-04 | `<Link>` / `<NavLink>` with active styling | R | Sidebar nav, detail tabs | `src/shared/layout/AppShell.tsx` — `AppShell` (`ListItemButton component={NavLink}`; React Router appends its own `active` class to the className MUI hands down, which the `&.active` block in `sx` styles from the theme rather than from a CSS Module). Moved out of `AppLayout` this pass — `AppLayout` still owns the `<Outlet>`, the chrome around it is `AppShell` | [x] |
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
| W3-D1-04 | `useMemo` — referential stability of a provider value | R | The MUI theme object handed to `ThemeProvider` | `src/shared/theme/ThemeModeProvider.tsx` — `ThemeModeProvider` (`theme = useMemo(() => createAegisTheme(mode), [mode])`). **Upgraded from `[~]` and rehomed.** The old home was `AuthProvider`, where the bail-out branch was unreachable; that file no longer exists (W4-D4-01). This memo's bail-out *is* reachable and is one click away: the toggle cycles Light → Dark → System, and choosing System on a light-mode machine changes `choice` — re-rendering the provider — while leaving `mode` at `'light'`, so the memo returns the same theme object and `ThemeProvider`, which compares by identity, re-renders nothing. Without it that click re-serialises Emotion's styles for every `styled()` component and every `sx` prop in the app. The `choiceValue` memo beside it is the inert one, and its own header says so | [x] |
| W3-D1-05 | `useCallback` — stable handler into memo child | R | `onSelect` passed to `PolicyRow` | `src/routes/PoliciesPage.tsx` — `handleSelect` | [x] |
| W3-D1-06 | When NOT to optimise (documented counter-example) | R | `docs/failure-modes.md` + header note on a deliberately un-memoised leaf | `src/routes/policies/FilterStatus.tsx` — `FilterStatus` (header note; the `docs/failure-modes.md` companion table is Phase 5's, per `docs/phase-prompts.md`) | [x] |
| W3-D2-01 | Rules of hooks (violation demonstrated) | R | Registered lab defect: conditional hook call | `src/shared/labs/ConditionalHookDemo.tsx` — `ConditionalHookDemo` | [x] |
| W3-D2-02 | Custom hook — `useLocalStorage` | R | Recently-viewed policies list on /policies; persisted theme choice in the app header | `src/shared/hooks/useLocalStorage.ts` — `useLocalStorage`, used by `src/routes/PoliciesPage.tsx` and `src/shared/theme/ThemeModeProvider.tsx` (theme). The claim is unchanged — it was already satisfied by the first caller. The second is listed because a hook with one caller is indistinguishable from a function that should have been inlined, and the two callers hold unrelated value types (a list of policy ids, a `ThemeChoice` union), which is what makes the generic parameter load-bearing rather than decorative | [x] |
| W3-D2-03 | Custom hook — `useDebounce` | R | Policy search input | `src/shared/hooks/useDebounce.ts` — `useDebounce`, used by `src/shared/hooks/usePolicyFilters.ts` | [x] |
| W3-D2-04 | Custom hook — `useFetch` | R | Claims history loader | `src/shared/hooks/useFetch.ts` — `useFetch`, used by `src/routes/policyDetail/PolicyClaimsTab.tsx` (not one of Phase 3's own target rows, but built as part of it and genuinely reachable — closing it now rather than leaving it stale) | [x] |
| W3-D2-05 | Custom hook — composition (hook using hooks) | R | `usePolicyFilters` = search params + debounce + memo | `src/shared/hooks/usePolicyFilters.ts` — `usePolicyFilters` | [x] |
| W3-D2-06 | Testing a custom hook | R | `useDebounce.test.ts`, `useLocalStorage.test.ts` (fake timers) | `src/shared/hooks/useDebounce.test.ts`, `src/shared/hooks/useLocalStorage.test.ts` | [x] |
| W3-D2-07 | Testing a component | R | `PolicyList.test.tsx` — filter narrows rows | `src/routes/policies/PolicyList.test.tsx` | [x] |
| W3-D3-01 | `React.lazy` — route-level splitting | R | All top-level routes | `src/shared/routes/lazyRoutes.tsx` — `splitChunk` + the seven top-level route exports, consumed by `src/App.tsx`'s `BoundedRoute`; separate chunks confirmed in `vite build` output, and every route walked at runtime by `src/App.test.tsx`. Still true as written, but read it alongside [Honest gap: MUI's runtime is in the entry chunk](#honest-gap-muis-runtime-is-in-the-entry-chunk) — the mechanism is intact; the share of the bundle it defers is smaller since Week 4 Day 2 | [x] |
| W3-D3-02 | `React.lazy` — component-level splitting | R | Claim intake wizard (heavy, modal-only) | `src/routes/ClaimIntakePage.tsx` — module-scope `splitChunk('ClaimIntakeWizard', () => import('./claimIntake/ClaimIntakeWizard'))`, rendered only inside an open `<Modal>`. The `import()` stays in this file (it is what draws the chunk boundary); only the memoise/log/reset mechanism is shared with the route chunks — which is how its Retry got fixed alongside theirs. Verified twice: its own chunk in `vite build`, and *not* loaded while the modal is closed by `src/App.test.tsx` | [x] |
| W3-D3-03 | `<Suspense>` fallback | R | Per-route boundary | `src/App.tsx` — `LazyRoute` (one `<Suspense>` per route **and** per `/policies/:id` tab); also `src/routes/PolicyDetailPage.tsx`, `src/routes/policyDetail/RiskExposureWidget.tsx`, `src/routes/ClaimIntakePage.tsx` | [x] |
| W3-D3-04 | Skeleton UI while chunk loads | R | `Skeleton.tsx` variants | `src/shared/components/Skeleton.tsx` — `Skeleton` (`table` / `card` / `panel`) | [x] |
| W3-D3-05 | Preloading on intent (hover/focus) | R | Sidebar nav preloads route chunk | `src/shared/routes/lazyRoutes.tsx` — `preloadPath` / `SplitChunk.preload`, wired to `onMouseEnter` **and** `onFocus` in `src/shared/layout/AppShell.tsx`; logs `[chunk] ↓ … (preload)` then `⤳ … already requested (render)`. The memoisation those two lines depend on is asserted in `src/shared/routes/lazyRoutes.test.tsx` — two preloads plus a render must call the loader once | [x] |
| W3-D4-01 | Error Boundary class component | R | `ErrorBoundary.tsx` — `getDerivedStateFromError` + `componentDidCatch` | `src/shared/components/ErrorBoundary.tsx` — `ErrorBoundary`; tested in `src/shared/components/ErrorBoundary.test.tsx` | [x] |
| W3-D4-02 | Boundary retry that actually recovers (key bump) | R | Retry remounts children via key | `src/shared/components/ErrorBoundary.tsx` — `handleRetry` + `<Fragment key={attempt}>`, paired with `onRetry` at every call site. **Was measurably false, now repaired** — this row was flagged for downgrade and instead fixed, because the fix was available. The old claim was that the `key` bump clears `React.lazy`'s memoised rejection; it does not (a probe recorded one import attempt before Retry and one after), so `App.tsx`'s route-level Retry could never recover a failed chunk and `ClaimIntakePage`'s had the same hole. Fixed by `splitChunk().reset()` in `src/shared/routes/lazyRoutes.tsx`, wired through `App.tsx`'s `BoundedRoute` and `ClaimIntakePage`. Now three mechanisms, all tested: the remount and the eviction ordering in `ErrorBoundary.test.tsx`, the lazy reset in `src/shared/routes/lazyRoutes.test.tsx` — including a negative test that fails if remounting ever starts recovering on its own. `ErrorBoundary.tsx`'s header carries the correction | [x] |
| W3-D4-03 | Scoped boundary — widget fails, page survives | R | Claims widget throws; policy detail still renders | `src/routes/policyDetail/RiskExposureWidget.tsx` — `RiskExposurePanel`, wired to `api.ts`'s always-rejecting `fetchRiskFeed` behind the `risk-feed-outage` lab toggle. **Deliberate deviation:** the failing widget is the risk feed, not the Claims tab. Making Claims the one that throws would mean converting it from the `useFetch` + `AbortController` path to the `use()` + Suspense path, and CLAUDE.md requires both paths to exist *and* to be contrastable — they now sit on the same page, one tab apart. `fetchRiskFeed` was built in Phase 0 for exactly this row (see its header) | [x] |
| W3-D4-04 | `useLayoutEffect` vs `useEffect` (flicker shown) | R | Sticky premium summary measuring header height | **Not built — the concept has no home in this app.** `useLayoutEffect` no longer appears anywhere under `src/`. It lived in `src/routes/quoteWizard/StickyPremiumSummary.tsx`, measuring the wizard header so the bar could dock beneath it, and it was load-bearing while the bar was `position: fixed` — there `top` is where the element is *drawn*. When the bar moved into normal flow as `position: sticky`, `top` stopped meaning that and started meaning the viewport offset the bar clamps at while pinned; the measured header bottom (~200px) pinned the bar a fifth of the way down the screen, on top of the fields scrolling under it. The correct sticky offset is a design constant the stylesheet states directly, so the measurement, `dockTop`, `FALLBACK_TOP_PX`, both effect branches and the `layout-effect-flicker` lab defect were all computing a value nothing could read, and all of them were deleted rather than left in the tree as dead code. **No contrived replacement was invented.** There is no other place in this app where a component must read a rendered dimension before paint, and building one — a measured tooltip, a synthetic panel in `labs/` — would be a component that exists for the matrix rather than for the app, which `CLAUDE.md` ranks as worse than an honest gap. See [Known weak claims](#known-weak-claims) | [ ] |
| W3-D4-05 | `forwardRef` | R | `Modal`, `TextField` | `src/shared/components/Modal.tsx` — `Modal` (`TextField` deliberately does not need `forwardRef` — see its own header; nothing in the app grabs its DOM node directly, `Modal`'s generic `querySelectorAll` focus search covers it) | [x] |
| W3-D4-06 | `useImperativeHandle` — exposed API | R | `modalRef.current.open()/close()/focusFirst()` | `src/shared/components/Modal.tsx` — `Modal`, consumed via `modalRef` in `src/routes/policyDetail/PolicyClaimsTab.tsx` | [x] |
| W3-D5-01 | `use()` — unwrapping a promise | R | Policy detail data | `src/routes/policyDetail/PolicySummaryCard.tsx` — `PolicySummaryCard` (`use(getPolicyResource(policyId))`, no loading/error state of its own) | [x] |
| W3-D5-02 | Suspense for data + cached promise (no fetch loop) | R | `api.ts` promise cache keyed by policy id | `src/shared/api.ts` — `getPolicyResource` / `clearPolicyResource`, consumed by `PolicySummaryCard` and `RiskExposureWidget`. Proved in the console: one `[api] →` per policy per session against many `[api] ⤳ cache hit` + `[render] PolicySummaryCard` pairs | [x] |
| W3-D5-03 | `use()` with Context (conditional read) | R | Theme/role read inside a branch | **Not built — the mechanism did not survive the Redux migration, and no replacement was invented.** `PolicySummaryCard` read the role with `use(AuthContext)` inside its `lapsed`/`cancelled` branch, so an active policy never subscribed to auth at all. `AuthContext` was deleted when the session moved into a Redux slice (W4-D4-01), and `useAppSelector` is a hook: it subscribes on every render whether the branch is taken or not. There is no conditional *and reactive* store read to swap in — `use(ReactReduxContext)` inside the branch compiles and returns the store, but the store reference never changes, so the note would be computed once and then go stale on the next role switch. Keeping `AuthContext` alive purely to carry this row would restore the two-sources-of-truth-for-role that the migration removed. Recorded as a gap; see [Known weak claims](#known-weak-claims) and `PolicySummaryCard.tsx`'s header, which states the trade in full | [ ] |
| W3-D5-04 | Suspense + ErrorBoundary together | R | Rejected promise caught by boundary | `src/routes/policyDetail/RiskExposureWidget.tsx` — `RiskExposurePanel` (ErrorBoundary → Suspense → `use()` on a promise that is pending then rejected); same pairing in `src/App.tsx`'s `LazyRoute` and `src/routes/PolicyDetailPage.tsx` | [x] |
| W3-D5-05 | Refactor prior routes to lazy-load | R | Whole route table | `src/App.tsx` — `App`; all seven top-level routes **and** the three `/policies/:id` tabs are lazy. Walked at runtime by `src/App.test.tsx` | [x] |

---

## Week 4 — UI Libraries, Theming & API Integration

| ID | Concept | Tier | Feature that forces it | File / Export | Done |
|---|---|---|---|---|---|
| W4-D1-01 | `ThemeProvider` + `CssBaseline` mounted above the router | R | Theme and baseline reset must apply to every MUI route, so they mount above `BrowserRouter` in `main.tsx` | `src/shared/theme/ThemeModeProvider.tsx` — `ThemeModeProvider`, mounted in `src/main.tsx` **outside** `<BrowserRouter>`. Closed as a prerequisite of the W4-D2 rows rather than as part of that target list: `sx`, `styled()` and the custom `status` key are all reads off the theme context, so none of them can be demonstrated — or even rendered without throwing — until a provider exists. Measured, not assumed: a temporary probe dumped the `body` rule Emotion injects before and after a mode change (`background-color:#f4f5f7` → `#12151a`, `color:#16191d` → `#e6e9ee`), which is `CssBaseline` doing the repaint. The probe was deleted; the durable part of it is `src/shared/theme/ThemeModeProvider.test.tsx` | [x] |
| W4-D1-02 | MUI core components (`AppBar`, `Card`, `Table`, `Dialog`, `Button`, `TextField`) | R | `/dashboard` KPI cards, `/underwriting` table, `ClaimIntakeWizard` dialog | `src/shared/layout/AppShell.tsx` — `AppShell` (`AppBar` + `Toolbar` + `Drawer`, and the `TextField select` role switcher), `src/routes/DashboardPage.tsx` — `DashboardPage` (four metric `Card`s, the expiring-policies `Table`), and `src/routes/UnderwritingPage.tsx` — `UnderwritingPage` (three metric `Card`s and the exposure `Table`, added with W4-D4-04 because the memoised selector needed a consumer). **Qualified — four of the six named components.** `Dialog` and `Button` are not here. `ClaimIntakeWizard` is the surface that wants a `Dialog` and it is still a pre-Week-4 placeholder (W4-D5); `Button` has no call site on either surface this pass built — the dashboard's one affordance is a link into `/policies?expiring=1`, which is a `Link`, and the two app-bar controls are an `IconButton` and a select. Rendering a `Button` that does nothing, or dressing the link as one, would be a component placed for this row rather than for the page, which `CLAUDE.md` ranks below an honest gap | [~] |
| W4-D1-03 | `Grid2` / `Box` / `Stack` layout | R | `/dashboard` KPI grid and `/underwriting` filter bar | `src/routes/DashboardPage.tsx` — `DashboardPage`: one `Grid` container (`@mui/material/Grid2`) holding all six items — four metric cards at `size={{ xs: 12, sm: 6, md: 3 }}`, the renewals table at `{ xs: 12, md: 8 }`, the claims breakdown at `{ xs: 12, md: 4 }` — with `Box` for the page column and `Stack` for the in-card rows. `Box`/`Stack` also carry `AppShell`'s toolbar and nav regions. One container rather than one per row, so the vertical gutter between the metric row and the panel row is the same 16px as the horizontal one | [x] |
| W4-D1-04 | Responsive breakpoints via theme, not media queries | R | `/dashboard` grid collapsing to one column on narrow viewports | `src/routes/DashboardPage.tsx` (the `size` objects above, plus `sx={{ display: { xs: 'none', sm: 'table-cell' } }}` dropping the Customer and Type columns on narrow viewports) and `src/shared/layout/AppShell.tsx` (`display: { xs: 'none', md: 'block' }` swapping the permanent `Drawer` for the temporary one, and the app bar's progressive disclosure of the valuation date and branch). Every one of those keys is resolved by MUI against `theme.breakpoints`; neither file hand-writes a media query, which is what stops the drawer's `md` and the grid's `md` from drifting into a band of widths where the nav has collapsed but the content has not | [x] |
| W4-D2-01 | `createTheme` palette incl. custom `status` key | R | Policy/claim status colours on MUI surfaces — the theme-level counterpart to `STATUS_CLASS` (W1-12) | `src/shared/theme/theme.ts` — `createAegisTheme` (`palette.status`: four `{ main, soft }` pairs mirroring `--c-status-*` / `--c-status-*-soft` in `global.css`), typed — not `any` — by the `Palette`/`PaletteOptions` augmentation in `src/shared/theme/mui-augment.d.ts`. Read by `StatusChip` on /dashboard; values pinned per mode in `ThemeModeProvider.test.tsx`. The augmentation file is named `mui-augment.d.ts` and not `theme.d.ts` for a reason recorded in its own header: a `.d.ts` beside a `.ts` of the same basename is dropped by TypeScript's wildcard matcher, so it was in the repo, looked correct, and was not in the program — the symptom being three errors in *other* files | [x] |
| W4-D2-02 | Typography + spacing overrides, `defaultProps`, `styleOverrides` | R | House style declared once in the theme instead of per-component | `src/shared/theme/theme.ts` — `createAegisTheme`: `typography.h1`/`h2`/`body2` and `button` (`textTransform: 'none'`), `spacing: 8`, `components.MuiButton.defaultProps` (`disableElevation`), `components.MuiCard.styleOverrides.root` (6px, matching `.panel`). `typography.body1` is overridden too, and not for house style: `CssBaseline` spreads body1 onto `body` and its sheet lands after `global.css`, so MUI's default 1rem would have become the base font size for the *whole* app — CSS Modules routes included. Caught by the probe described on W4-D1-01, which showed `font-size:13px` in the emitted `body` rule | [x] |
| W4-D2-03 | Dark/light toggle persisted through `useLocalStorage` | R | AppBar theme toggle in `AppLayout`, surviving reload via the existing `useLocalStorage` (W1-07, C-08) | `src/shared/theme/ThemeModeProvider.tsx` — `ThemeModeProvider` / `useThemeChoice`, driven by the Theme `<select>` in `src/shared/layout/AppLayout.tsx`; persisted under `aegis.theme` by `useLocalStorage`, resolved for `'system'` against `matchMedia`, and read pre-paint by the bootstrap script in `index.html`. Reload survival is pinned by `src/shared/theme/ThemeModeProvider.test.tsx` (a `cleanup()` then a fresh mount, so only `localStorage` crosses the boundary). **Repaired this pass — the control is now the AppBar's.** The `<select>` this row was qualified on is gone with the CSS Modules header; the toggle is the `IconButton` in `src/shared/layout/AppShell.tsx`, calling the same `setChoice`. It cycles Light → Dark → System rather than toggling two states, because `'system'` is the only choice that keeps the `matchMedia` subscription alive — a two-state button would make the first click a one-way door out of "follow my OS" | [x] |
| W4-D2-04 | `styled()` API | R | A reusable themed component used on more than one MUI surface | `src/shared/theme/StatusChip.tsx` — `StatusChip` (`styled(Chip, { shouldForwardProp })` reading `theme.palette.status[status]`), rendered on /dashboard's book-by-status strip. The deliberate duplicate of `.statusActive`…`.statusCancelled` in `src/routes/policies/PolicyRow.module.css`, which stays; its header states what each of the two approaches costs. **Qualified — one MUI surface, not more than one.** /underwriting and `ClaimIntakeWizard` are the other two MUI surfaces `CLAUDE.md` names, and both are still pre-Week-4 placeholders, so there is exactly one surface to consume this today. Giving it a second consumer now would mean building a status list somewhere for the component's benefit rather than the app's | [~] |
| W4-D2-05 | `sx` prop | R | One-off spacing/alignment adjustments that do not earn a `styled()` component | `src/routes/DashboardPage.tsx` — `DashboardPage` (`sx` on `Box`/`Stack`/`Typography`/`Card`/`TableCell` for the page column gap, the redirect notice's padding and ground, the equal-height cards, the claims proportion bars and the per-breakpoint column hiding) and `src/shared/layout/AppShell.tsx` (the app bar's `zIndex` callback and border, the drawer paper width, the nav item's `&.active` state) — every one used once, in one place, with no variant axis. The contrast is the point and is argued in both headers: the badge on the same page is a `styled()` component because it is reused and varies by `PolicyStatus`, and `StatusChip.tsx` spells out why the reverse assignment fails in both directions | [x] |
| W4-D3-01 | axios instance + `baseURL` | R | Single configured client for every Week 4 request | `src/shared/http/client.ts` — `http` (`axios.create({ baseURL: '/api', timeout: 8000 })`), wired in `src/shared/http/index.ts`, which is the composition root: it attaches `installMockBackend` and `installInterceptors` to the instance at module load, before any component can fire the first request. The backend is `axios-mock-adapter` bound to that instance and answering from `src/shared/data` — mocked at the *adapter*, not at the endpoint functions, so every request is dispatched by axios for real and every interceptor genuinely executes. Consumed from a clickable route by `src/routes/policyDetail/PolicyClaimsTab.tsx` via `src/shared/http/endpoints.ts`. `src/shared/api.ts` is untouched and still serves every other surface — it is the control group this stack is measured against | [x] |
| W4-D3-02 | Request interceptor — token attach | R | Auth token attached to every outgoing request without each call site knowing | `src/shared/http/interceptors.ts` — `installInterceptors`, interceptor **(a)**: reads `store.getState().auth.token` (W4-D4-01 — `tokenStore.ts` was deleted with the migration, the token now lives in the auth slice with the rest of the session) and sets `Authorization: Bearer …`, plus an `x-correlation-id` header and `meta.startedAt` for the timing log. It also owns the session bootstrap — the first request with no token in the store awaits one single-flight `POST /auth/login` and every request fired in the same tick queues behind it — and skips the attach entirely for `/auth/*`, because the login travels over this same instance and would otherwise wait on itself. The token store is plain module state, not Context: an interceptor registered at module load has no component to call `useContext` from. Pinned by `src/shared/http/interceptors.test.ts` ("attaches the bearer token", "does not attach a token to the login request itself", "shares one login") | [x] |
| W4-D3-03 | Response interceptor — logging + error normalisation | R | One error shape reaching the UI regardless of what the transport returned | `src/shared/http/interceptors.ts` — interceptor **(b)** logs `[http] ← METHOD path status elapsedMs req-NNNN` off `config.meta`, and interceptor **(c)** turns all four failure shapes — a response with a status, an `AxiosError` with no response (timeout/`ECONNABORTED`), a `CanceledError`, and a non-axios throw — into one `ApiError { status, code, message, correlationId }`, preferring the server's own `code`/`message` over the transport's "Request failed with status code 503". Registered as three separate `use()` calls rather than one `use(onSuccess, onError)` pair, so each is ejectable and defensible on its own. `PolicyClaimsTab` renders `error.message` and now gets the backend's sentence. Pinned by `interceptors.test.ts` (503 and 404 normalisation, including the correlation id surviving onto the error) | [x] |
| W4-D3-04 | 401 refresh with single-flight queue and retry guard | R | Concurrent `/underwriting` requests hitting an expired token must refresh once, not N times, and must not retry forever | `src/shared/http/interceptors.ts` — interceptor **(c)**'s `refreshOnce()`: a 401 sets `config._retry`, awaits the shared refresh promise (a second 401 arriving mid-flight joins it rather than starting its own — the queue *is* the promise; each waiter is already parked in its own `await` and resumes in place, so there is no hand-rolled replay list), then replays via `instance.request(config)` carrying the original correlation id and the new token. A replay that 401s again finds `_retry` set and is normalised instead of refreshed, which is the loop guard. Live toggle: `expire-token` in `src/shared/labs/registry.ts`, which revokes the presented token in the mock backend and switches itself off, so the next request 401s, refreshes and succeeds with nothing on screen going wrong. **Qualified — the *burst* is not clickable.** No built surface fires parallel requests: the Claims tab fires one, and `/underwriting` (W4-D5-04) is the surface the row's wording actually names and it does not exist yet. The concurrency claim is therefore pinned by test rather than by demo — `interceptors.test.ts` fires three requests at one expired token and asserts exactly one `POST /auth/refresh`, two attempts each, and the same `req-NNNN` on both attempts. Building a page that fires three requests to make this clickable would be a surface built for this row | [~] |
| W4-D3-05 | Cancellation — `AbortSignal` through axios | R | Navigating away from `/underwriting` mid-request — the axios counterpart to the hand-rolled `AbortSignal` path in `src/shared/api.ts` | `src/shared/http/endpoints.ts` — `fetchClaimsForPolicy` / `submitClaim` pass the caller's signal straight through as axios's `config.signal`; the signal originates in `src/shared/hooks/useFetch.ts`'s `AbortController` and is consumed by `PolicyClaimsTab`. The backend half is `delay()` in `src/shared/http/mockBackend.ts`: `axios-mock-adapter` ignores `config.signal` entirely (it settles on a bare `setTimeout`), so without that listener the abort would be a no-op at the transport and the stale response would still arrive. It rejects with axios's own `CanceledError`, carrying the config so the abort is still attributable to a correlation id. Observable by clicking two policies' Claims tabs inside a second: `[useFetch] cleanup — aborting in-flight request` → `[api] ✕ … aborted` → `[http] ✕ … canceled 29ms req-NNNN`, and no `[api] ←` for the abandoned one. Pinned by `interceptors.test.ts` | [x] |
| W4-D4-01 | `configureStore` + typed hooks | R | One store for the session, read by React *and* by the axios interceptor | `src/shared/store/index.ts` — `makeStore` / `store` / `useAppSelector` / `useAppDispatch` (`useSelector.withTypes<RootState>()`, `useDispatch.withTypes<AppDispatch>()`), mounted as `<Provider store>` in `src/main.tsx`. Consumed by `src/shared/routes/RequireRole.tsx`, `src/shared/layout/AppShell.tsx`, `src/routes/policyDetail/PolicySummaryCard.tsx` and `src/routes/UnderwritingPage.tsx` — all four through `src/shared/store/useAuth.ts`, which keeps the `useAuth()` name over `useAppSelector` so the migration is one import line per call site. The non-React consumer is the point: `src/shared/http/interceptors.ts` reads `store.getState().auth.token` on every outgoing request, which is what let `tokenStore.ts` be deleted | [x] |
| W4-D4-02 | `createSlice` with Immer | R | Role switching written as mutation, applied immutably | `src/shared/store/authSlice.ts` — `switchRole` and `logout`, both written as plain assignment to the draft. Clickable: the "Viewing as" select in `src/shared/layout/AppShell.tsx` dispatches `switchRole`, and `RequireRole` re-gates `/underwriting` on the result — which is the observable, because it can only happen if Immer produced a *new* `auth` object for react-redux's `Object.is` check to notice. `logout` runs on the terminal 401 path in `interceptors.ts`. Deliberately the opposite style to `quoteReducer` (W2-D3-01/02) one file away, and both headers say why | [x] |
| W4-D4-03 | `createAsyncThunk` + `extraReducers` lifecycle | R | Sign-in and token refresh showing pending / fulfilled / rejected from one thunk | `src/shared/store/authSlice.ts` — `loginThunk` (`POST /auth/login`) and `refreshThunk` (`POST /auth/refresh`), both through the axios client, with all six lifecycle actions handled in `extraReducers` via the builder callback. Clickable: switching role re-authenticates (the mock backend stamps the role into the token it issues, `at-3-underwriter`), and the "Viewing as" select in `AppShell` renders all three states — disabled on `pending`, back to normal on `fulfilled`, `error` + `helperText` on `rejected`. `loginThunk` is also what the request interceptor dispatches to bootstrap the session on the first request | [x] |
| W4-D4-04 | `createSelector` memoised derivation | R | Exposure totals per customer, recomputed only when the signed-in user changes | `src/shared/store/selectors.ts` — `selectExposureByCustomer`, consumed by `src/routes/UnderwritingPage.tsx`. The derivation is genuinely expensive: it scopes the book by role, then runs `rateBook` over the survivors — the same convolution `PoliciesPage` wraps in a `useMemo` (W3-D1-03), which prints its own elapsed ms. Observable from the console: `[compute] exposure roll-up` and `[rating] rateBook …` print once on arrival and then stay silent through every `auth/login/*` and `auth/refresh/*` action, because the selector's only input is `state.auth.user` and `DEMO_USERS[role]` is referentially stable. `selectRole` and `selectIsUnderwriter` beside it are deliberately **not** memoised — they return primitives, and the file says so | [x] |
| W4-D4-05 | Context retained for `QuoteContext` — the deliberate contrast | C | `/quote` stays on Context + `useReducer` while the session runs on Redux Toolkit, so the two can be compared side by side (see the Week 4 boundary section in `CLAUDE.md`) | `src/main.tsx` — `<Provider store>` (Redux Toolkit, the session) and `<QuoteProvider>` (Context + `useReducer`, the wizard draft) wrap the same tree, eight lines apart. `src/shared/store/QuoteContext.tsx` is untouched by the migration: hand-rolled immutable returns, a split state/dispatch context, a lazy `useReducer` init. `src/shared/store/authSlice.ts` re-solves the same problem with `createSlice` + Immer + thunks, and its header names the difference | [x] |
| W4-D5-01 | `useForm` + `register` + `Controller` | R | `ClaimIntakeWizard` fields — `register` for plain inputs, `Controller` for MUI controlled components |  | [ ] |
| W4-D5-02 | Zod schema + `zodResolver` + `z.infer` as the single source of type | R | Claim intake validation, with the form's TypeScript type derived from the schema rather than declared twice |  | [ ] |
| W4-D5-03 | `formState` — `errors`, `isSubmitting`, `isDirty`, per-step `trigger()` | R | Wizard step gating — a step cannot be left until its own fields validate |  | [ ] |
| W4-D5-04 | Integrated authenticated dashboard (`/underwriting`) | R | The route that puts theming, axios, Redux Toolkit and the form stack together in one authenticated surface |  | [ ] |

---

## Completeness tier — remaining React 19 hooks & APIs

| ID | Concept | Tier | Feature that forces it | File / Export | Done |
|---|---|---|---|---|---|
| C-01 | `useId` | C | Repeated insured-party fieldsets — label/input pairing | `src/shared/components/TextField.tsx` — `TextField`, used per-row in the insured-party fieldset in `src/routes/QuoteWizardPage.tsx`'s `ApplicantStep` | [x] |
| C-02 | `useTransition` | C | Switching policy-book tabs without blocking input | `src/routes/PoliciesPage.tsx` — `handleViewChange` (`useTransition`), with `isPending` surfaced by `src/routes/policies/PolicyBookTabs.tsx` and the view whose render cost justifies it in `src/routes/policies/ExposureByCustomer.tsx` | [x] |
| C-03 | `useDeferredValue` | C | Large filtered list lags behind search box | `src/shared/hooks/usePolicyFilters.ts` — `usePolicyFilters` (`deferredQuery`) | [x] |
| C-04 | `useSyncExternalStore` | C | Online/offline sync banner | `src/shared/components/ConnectivityBanner.tsx` — `ConnectivityBanner` (module-level `subscribe`/`getSnapshot`/`getServerSnapshot`, read with `useSyncExternalStore` in the component), mounted once in `src/shared/layout/AppLayout.tsx` so it is reachable from every route. **On `labs/registry.ts`:** that module is exactly as legitimate a candidate for this row as `window`'s `online`/`offline` events — plain module state with a `subscribe`/`notify` pair, external to React, read via `useLabFlag`'s own `useState` + `useEffect` bridge instead of `useSyncExternalStore`. It is deliberately left alone rather than rewritten to claim this row, for two reasons. First, the named feature this row asks for is the connectivity banner specifically (see "Feature that forces it" above), and `ConnectivityBanner` already builds that honestly — rewriting `useLabFlag` in addition would be a second, redundant claim on the same row, not a stronger one. Second, `useLabFlag` is working infrastructure that five other lab defects (`W2-D1-05`, `W2-D1-06`, `W2-D3-02`, `W3-D2-01`, `W3-D4-03`) and the C-05 toggle all depend on (a fifth, `W3-D4-04`, was deregistered when its host code was deleted); changing it now would be a rewrite made for the matrix's benefit rather than the app's, which CLAUDE.md rules out ("a contrived usage is worse than an honest gap"). `useLabFlag`'s own header already documents why it exists as a `useState`+`useEffect` bridge rather than `useSyncExternalStore`. | [x] |
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

**Total rows: 106. Solid `[x]`: 93. Qualified `[~]`: 7. Not built `[ ]`: 6.**

> Corrected in Week 4 Day 2: this line read "Total rows: 83 … Not built: 1"
> until now, and both numbers had been wrong since the Week 4 section was
> added — that commit appended 23 rows to the table and left every count in
> the file describing the Week 1-3 app. The failure is the one this document
> is supposed to be immune to: the totals said full coverage was one row away
> while 24 rows had no code behind them. Counted by section: W1 14, W2 30,
> W3 32, W4 23, completeness tier 13 — 106.

The previous line here read "Complete: 83. Remaining: 0", and that number was
defensible only against criteria that turned out to be too weak. A post-Phase-5
audit re-checked every row against a harder question than "does the file exist
and can I click to it" — *can the mechanism be observed doing anything?* — and
five rows failed it. They are listed below with what would make each solid, and
the table has grown since.

None of the five is a missing feature, and none is fixed here by adding one.
Four are correct code whose effect is unobservable in this app; the fifth is a
concept the app has no honest home for. `CLAUDE.md` ranks a contrived usage as
worse than an honest gap, so **inert is recorded as inert**.

A **sixth** row joined them later and has since gone further than any of the
five. W3-D4-04 was genuinely solid when it was written. A product change to
`StickyPremiumSummary`'s positioning took its *observable* away, and it went to
`[~]`; a follow-up change took the *code* away, and it is now `[ ]`. That
progression is worth keeping visible, because it is the case this table will
keep seeing: not a row that was never really demonstrated, but a row whose demo
was collateral damage from changes the app wanted for its own reasons.

W3-D5-03 is the **second** row to take that path, and it took it in one step
rather than two. The Redux Toolkit migration (W4-D4-01) deleted `AuthContext`,
and with it the conditional `use(AuthContext)` read in `PolicySummaryCard` that
was this row's whole demonstration. It is worth being exact about the cost,
because it is small and the row is not: what was lost in *behaviour* is one
re-render of one card per role switch, since only one `PolicySummaryCard` is
ever mounted. What was lost in *coverage* is the only place in the app where a
Context was read from inside a branch. The two obvious ways to keep the row are
both worse than the gap — a non-reactive `use(ReactReduxContext)` read that
goes stale, or `AuthContext` kept alive beside the slice so that the role lives
in two places. Neither is a demonstration of anything except how far this file
will push a component around. Recorded as `[ ]`.

The second step is the one worth defending. Moving the bar to `position:
sticky` did not merely make the measurement invisible — it made it *wrong*.
Under `fixed`, `top` is where the element is drawn, so the measured header
bottom put the bar directly beneath the header. Under `sticky`, `top` is the
viewport offset the element clamps at while pinned, so that same ~200px pinned
the bar a fifth of the way down the screen and over the fields scrolling
beneath it. Once the inline `style={{ top }}` came off and the offset moved
into the stylesheet where it belongs, `dockTop`, `FALLBACK_TOP_PX`,
`measure()`, the `useLayoutEffect`/`useEffect` pair and the
`layout-effect-flicker` lab defect were all computing a number nothing could
read. `CLAUDE.md` does not permit that to sit in the tree as dead code
wearing a demo's clothes, so it was deleted and the lab defect deregistered.

`useLayoutEffect` therefore appears nowhere in shipped code, and **no
contrived replacement was invented**. There is no other place in this app
where something must read a rendered dimension before paint; building one — a
measured tooltip, a synthetic `labs/` panel — would be a component that exists
for this file rather than for the app. That is the trade `CLAUDE.md` names
explicitly, and an honest `[ ]` is the side of it this repo takes.

| ID | Concept | Why it is qualified | What would make it `[x]` |
|---|---|---|---|
| W3-D1-02 | `memo` custom comparator | `PremiumBadge`'s comparator can never run — its memoised parent bails out first, so the child is never rendered. Measured in `docs/render-counts.md`. And it would lose if it ran: two `formatCurrency` calls to skip a render costing one. | A second `rateBook` pass that re-prices the same policy. The app runs exactly one per session, so this needs a feature that does not exist. Alternatively: delete the comparator and let shallow compare on `amount` do the job — the more honest edit. |
| W2-D2-06 | Split context | No dispatch-only consumer exists; all five wizard steps read both, via `useQuote()`. Even one would re-render anyway, because `QuoteWizardPage` reads state and renders the steps as children. | `React.memo` on the step components **and** a step that genuinely needs dispatch without state. Neither is wanted by the wizard as designed. |
| W3-D5-03 | `use()` with Context (conditional read) | **Not built.** The conditional read lived on `AuthContext`, which the Redux migration deleted; `useAppSelector` is a hook and cannot be called inside a branch. `use(ReactReduxContext)` would compile and would go stale, because the store reference never changes. | A Context that is genuinely still Context and genuinely read conditionally. `QuoteContext` is the one left, and no wizard step wants its draft on only some renders. Keeping `AuthContext` alive beside the slice purely to carry this row would put the role in two places, which is what the migration removed. |
| C-07 | `useFormStatus` | Real in `ClaimIntakeWizard`. Unobservable in `PolicyClaimsTab`'s `ClaimForm`: `handleLogClaim` closes the modal before its `await`, unmounting the form before `pending` can render. | Keeping the modal open until the action settles — which would cover the optimistic row (C-05) that is the actual feedback. The two features are in real tension; the hook loses. |
| W3-D4-04 | `useLayoutEffect` vs `useEffect` | **Not built.** The concept lost its home when the premium bar moved into normal flow: under `position: sticky` the measured offset was not just unobservable but actively wrong, so the measurement and both effect branches were deleted rather than kept as dead code. `useLayoutEffect` appears nowhere under `src/`. | A feature that genuinely must read a rendered dimension before paint — a tooltip or popover positioned against its anchor, a virtualised list measuring row heights. This app has none, and adding one to carry the row would be a component built for the matrix. Recorded as a gap instead. |
| W2-D1-01 | Mount-only fetch (`[]` deps) | No `[]`-deps *fetch* exists. `useFetch`'s `[policyId]` effect runs once on mount, but that is an argument for not building the row, not a demonstration of it. | A feature that genuinely fetches once and never refetches. Adding one to `PolicyClaimsTab` would ship the stale-data bug `useFetch` exists to prevent. |
| W4-D3-04 | 401 single-flight refresh | The refresh, the queue and the `_retry` guard are all real and all execute — but only the *single-request* half is clickable. The `expire-token` lab toggle shows one 401 recovering; the concurrent burst the row is actually about needs a surface that fires several requests at once, and no built surface does. It is pinned by `interceptors.test.ts` (three parallel 401s → one `POST /auth/refresh`) rather than by a demo. | `/underwriting` (W4-D5-04), which loads a queue, its filters and its totals together and hits the expired token with all of them. Adding a page that fires three requests before then would be a surface built for this row. |
| W4-D2-04 | `styled()` on more than one surface | `StatusChip` is real, themed, and rendered — but on /dashboard only. The row asks for reuse across MUI surfaces, and the other two (/underwriting, `ClaimIntakeWizard`) are still pre-Week-4 placeholders, so "reusable" is currently an assertion about the component rather than an observation about the app. | The /underwriting queue table (W4-D4-03) rendering policy status, which is a surface that wants the badge for its own reasons. Inventing a second consumer before then would be a component built for this file. |

### Repaired rather than downgraded

**W4-D2-03** left this table in Week 4 Day 1. It was qualified because the theme
mechanism was real but the control the row names — an AppBar toggle — did not
exist, so the switcher was still the CSS Modules `<select>`. `AppShell` built
the AppBar and the `IconButton` moved into it, calling the same `setChoice`.
`ThemeModeProvider` was not touched, which is what the qualification predicted.
The one deviation from the row's wording is deliberate and is argued in
`AppShell.tsx`'s header: the button steps Light → Dark → System rather than
toggling two states, because `'system'` is the only choice that keeps the
`matchMedia` subscription alive, and a two-state control would make the first
click a one-way door out of it.

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

Total rows: **106**. Solid: **88**. Qualified: **8**. Not built: **10** (W3-D4-04 plus the 9 Week 4 rows still open — see [Still unchecked after Week 4 Day 3](#still-unchecked-after-week-4-day-3)).

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
>     stays in the entry chunk, because the app chrome (`AppShell` since Week 4 Day 1) imports `AS_OF` from it
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

**One unbuilt, five qualified** — see [Known weak claims](#known-weak-claims),
added after this section was written. Of the 83 rows, 77 are `[x]`, five are
`[~]` (found by that audit), and one — W3-D4-04 — is `[ ]`. That row went to
`[~]` when the premium bar changed from `position: fixed` to `position:
sticky` and the visible flicker went with it, then to `[ ]` when the inline
`top` came off the bar entirely and the measurement, both effect branches and
the `layout-effect-flicker` lab defect were deleted rather than left computing
a value nothing reads. `useLayoutEffect` is no longer in the app.

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

## Still unchecked after Week 4 Day 1

**14 Week 4 rows, plus W3-D4-04.** This pass closed its three remaining target
rows — W4-D1-02, W4-D1-03, W4-D1-04 — and repaired W4-D2-03, which had been
qualified since Day 2 on the absence of the very AppBar this pass built. Two
files carry the work: `src/shared/layout/AppShell.tsx` (new — `AppBar`,
`Toolbar`, two `Drawer`s, the role `TextField` and the theme `IconButton`) and
a rebuilt `src/routes/DashboardPage.tsx` (`Grid2` + `Box` + `Stack`, four
metric `Card`s, the expiring-policies `Table`, the claims breakdown).

One of the three is `[~]`, and for the reason this document keeps insisting on:
**W4-D1-02 names six components and four are built.** `Dialog` belongs to
`ClaimIntakeWizard`, which is still a pre-Week-4 placeholder. `Button` has no
honest call site on either surface — the dashboard's one affordance is a
navigation into `/policies?expiring=1`, which is a `Link`, and the app bar's
two controls are an `IconButton` and a select. A `Button` rendered to close the
row would be a component placed for this file's benefit rather than the page's.

`AppLayout` was reduced rather than deleted: it still owns the `<Outlet>` and
mounts `ConnectivityBanner`, and `AppShell` wraps it with the chrome. That
split is what keeps the Week 4 boundary intact — the chrome is MUI, the content
region is agnostic, and `/policies` renders inside it untouched. Its CSS Module
(`AppLayout.module.css`) had no remaining consumer and was deleted; no matrix
row referenced it (W1-12's composed class is `PolicyRow.module.css`).

### The Day 2 prediction, measured

The [entry-chunk section](#honest-gap-muis-runtime-is-in-the-entry-chunk) below
closed by predicting that the next MUI surfaces "will each add only their own
components, not another copy of Emotion", and flagged that as unmeasured. It is
measurable now. Against the figures that section recorded, same command and
machine:

| Chunk | After Day 2 | After Day 1 |
|---|---|---|
| entry `index-*.js` | 359.24 kB (118.22 kB gzip) | 527.37 kB (167.58 kB gzip) |
| `DashboardPage` | 36.01 kB | 31.43 kB |

The prediction holds on the route chunk and is beside the point on the entry.
`DashboardPage` gained a `Table`, four `Card`s and a `Grid2` container and got
**smaller**, because the primitives underneath them are now reachable from the
statically-imported shell and were hoisted out of it — that is the shared
engine being paid once, exactly as claimed. The entry grew 168 kB anyway, and
the reason is the same mechanism read the other way: `AppShell` is imported
statically by `AppLayout`, so `AppBar`, `Drawer`, `TextField`, `Tooltip`,
`List` and four icons are all reachable from the entry and cannot be split.
The CSS Modules route chunks moved by under ~1 kB in either direction, which is
the part of the claim that was never in doubt.

**So the honest summary is that this pass made the code-splitting story worse in
absolute terms and better in marginal terms**, and W3-D3-01 should still be read
next to that section. Nothing here is fixable by lazy-loading the shell: it
renders on every route, above the `<Outlet>`, so deferring it would replace the
first paint of every page with a fallback.

### Still open

- **W4-D1 (0 of 4 open; 1 qualified):** W4-D1-02 completes when
  `ClaimIntakeWizard` becomes a MUI `Dialog` (W4-D5) and a real `Button` call
  site exists.
- **W4-D3 (5):** the whole axios section. `axios` and `axios-mock-adapter`
  are not installed and nothing imports them; `src/shared/api.ts`'s
  hand-rolled `fetch`-with-`AbortSignal` path is still the only transport,
  which is the control group W4-D3-05 is meant to be contrasted against.
- **W4-D4 (5):** the whole Redux Toolkit section. No store is mounted.
  W4-D4-05 (Context retained for `QuoteContext`) cannot be claimed either —
  that row is a *contrast*, and a contrast with nothing on the other side of
  it is just the Week 2 row it already is.
- **W4-D5 (4):** the whole react-hook-form + Zod section, and W4-D5-04, the
  integrated /underwriting surface that depends on W4-D3 and W4-D4 landing
  first. `ClaimIntakeWizard` still runs on `useActionState` and hand-rolled
  per-step validation (C-06), which is the baseline W4-D5-01…03 replace.
- **W3-D4-04 (1):** `useLayoutEffect`. Unchanged and still honestly unbuilt —
  see [Known weak claims](#known-weak-claims).

Two `[~]` rows are also still qualified and are not counted above, since both
name code that exists: W4-D1-02 (four of six components) and W4-D2-04
(`styled()` on one MUI surface, not more than one — `/underwriting` is the
surface that will want a `StatusChip` for its own reasons).

---

## Still unchecked after Week 4 Day 2

**17 Week 4 rows, plus W3-D4-04.** This pass closed six: W4-D2-01 through
W4-D2-05 (its target list) plus W4-D1-01, which is not a bonus so much as a
precondition — `sx`, `styled()` and `palette.status` are all reads off the
theme context, and every one of them throws or silently falls back to MUI's
default theme without a `ThemeProvider` above them. Two of the six are `[~]`
and both are qualified for the same reason: the surfaces that would complete
them are not built yet. See [Known weak claims](#known-weak-claims).

- **W4-D1 (3 of 4):** W4-D1-02 (`AppBar`, `Card`, `Table`, `Dialog`,
  `Button`, `TextField`), W4-D1-03 (`Grid2`/`Box`/`Stack` layout),
  W4-D1-04 (theme breakpoints). /dashboard uses `Box`, `Stack` and
  `Typography` today, and that is deliberately **not** claimed as W4-D1-03:
  that row's named feature is the KPI grid and the /underwriting filter bar,
  and neither exists — a `Box` used as a flex column is not the concept.
  `MuiCard`'s `styleOverrides` is likewise declared in the theme (W4-D2-02)
  with no `Card` yet rendering against it.
- **W4-D3 (5):** the whole axios section. `axios` and `axios-mock-adapter`
  are not installed and nothing imports them; `src/shared/api.ts`'s
  hand-rolled `fetch`-with-`AbortSignal` path is still the only transport,
  which is the control group W4-D3-05 is meant to be contrasted against.
- **W4-D4 (5):** the whole Redux Toolkit section. No store is mounted.
  W4-D4-05 (Context retained for `QuoteContext`) cannot be claimed either,
  even though `/quote` genuinely does run on Context + `useReducer`: that
  row is a *contrast*, and a contrast with nothing on the other side of it is
  just the Week 2 row it already is.
- **W4-D5 (4):** the whole react-hook-form + Zod section, and W4-D5-04, the
  integrated /underwriting surface that depends on W4-D3 and W4-D4 landing
  first. `ClaimIntakeWizard` still runs on `useActionState` and hand-rolled
  per-step validation (C-06), which is the baseline W4-D5-01…03 replace.
- **W3-D4-04 (1):** `useLayoutEffect`. Unchanged and still honestly unbuilt —
  see [Known weak claims](#known-weak-claims).

One thing this pass changed outside its own rows, recorded here because it
reverses an argument another file makes at length: the theme choice, its
`useLocalStorage` call and the `matchMedia` resolution **moved out of
`AppLayout` into `ThemeModeProvider`**. `AppLayout`'s header used to argue
that a theme context would be wrong because nothing below read the value. That
was true of a CSS-only app and is false now — MUI reads it — and `ThemeProvider`
has to sit above the router, which is above `AppLayout`. Keeping a copy in both
places would not have been a second opinion but a second `useState`: two
`useLocalStorage('aegis.theme')` calls share a key, not state, so the toggle
would have flipped the CSS Modules routes and left every MUI surface on its
mount-time value until a reload. Both headers now carry the reversal rather
than the original claim.

A second, smaller thing worth having in writing: the MUI module augmentation is
called `mui-augment.d.ts`, not `theme.d.ts`. TypeScript's wildcard matcher drops
a `.d.ts` when a `.ts` of the same basename exists — it assumes the former is
the latter's emitted output — so the augmentation was in the repo, looked
correct, and was not in the program at all. It failed loudly here (three `tsc`
errors, all in other files), but the same mistake in a file whose only job is
widening an interface would fail silently. An explicit `files` entry in
`tsconfig.json` also fixes it and was tried first; the rename is preferred
because it leaves no hand-maintained list to keep in sync with a rule about
filenames.

### Honest gap: MUI's runtime is in the entry chunk

Measured across a `vite build` before and after this pass — same machine, same
config, sizes as reported by Vite:

| Chunk | Before | After |
|---|---|---|
| entry `index-*.js` | 272.06 kB (87.59 kB gzip) | 359.24 kB (118.22 kB gzip) |
| `DashboardPage` | 0.46 kB | 36.01 kB |
| `PoliciesPage` | 12.06 kB | 12.05 kB |
| `QuoteWizardPage` | 6.68 kB | 6.68 kB |
| `ClaimIntakeWizard` | 6.40 kB | 6.38 kB |
| `PolicyDetailPage` | 5.32 kB | 5.32 kB |

`ThemeModeProvider` is a static import in `main.tsx`, so `@mui/material`'s
styling engine, `CssBaseline` and Emotion are all reachable from the entry and
cannot be lazily chunked. That is not an oversight to be tidied away by
`React.lazy`-ing the provider: the theme has to exist before the first route
renders, or the first paint of every MUI surface is either unthemed or a
suspended fallback. It is the same shape as the `src/shared/data` finding
already recorded in `lazyRoutes.tsx`'s header — a module reachable from
statically-imported chrome cannot be split — with a much larger module.

**This blunts the W3-D3 code-splitting claim, and that row should be read with
this section next to it.** Route-level splitting still does exactly what
W3-D3-01 says: seven route chunks, resolved on navigation, walked at runtime by
`App.test.tsx`. What changed is the *share of the bundle* it governs. Before
this pass the entry was 272 kB and the largest route chunk 12 kB, so splitting
deferred a real fraction of the app; now a first-time visitor downloads 359 kB
before any route renders, and splitting defers proportionally less of it.

One thing the table does **not** show, contrary to the way this change is easy
to describe: **the marginal per-route cost did not drop.** The six CSS Modules
route chunks are unchanged to within 0.02 kB, and the one MUI route went from
0.46 kB to 36.01 kB. What the shared entry actually buys is that the *engine* is
paid once — the second and third MUI surfaces (W4-D1-02's AppBar, the
/underwriting queue) will each add only their own components, not another copy
of Emotion. That is a real benefit, it is a different one, and it is unmeasured
here because those surfaces do not exist yet.

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

---

## Still unchecked after Week 4 Day 3

**9 Week 4 rows, plus W3-D4-04.** This pass closed its full five-row target
list — W4-D3-01 through W4-D3-05 — four of them solid and one (`W4-D3-04`)
qualified for a reason stated on the row and in
[Known weak claims](#known-weak-claims). No bonuses, no deferrals.

- **W4-D1 (1 of 4):** W4-D1-02 (`Dialog` and `Button` still have no call
  site) — unchanged, `[~]`.
- **W4-D2 (1 of 5):** W4-D2-04 (`styled()` on more than one surface) —
  unchanged, `[~]`.
- **W4-D4 (5):** the whole Redux Toolkit section. No store is mounted.
  W4-D4-05 (Context retained for `QuoteContext`) still cannot be claimed: a
  contrast with nothing on the other side of it is just the Week 2 row it
  already is.
- **W4-D5 (4):** the whole react-hook-form + Zod section, and W4-D5-04, the
  integrated `/underwriting` surface. `ClaimIntakeWizard` still runs on
  `useActionState` and hand-rolled per-step validation (C-06), which is the
  baseline W4-D5-01…03 replace.
- **W3-D4-04 (1):** `useLayoutEffect`. Unchanged and still honestly unbuilt.

### Two things this pass changed outside its own rows

**The axios stack landed on the Claims tab, not on `/underwriting`.** Four of
the five W4-D3 rows name `/underwriting` in their "feature that forces it"
column, and that route is still a role-gated placeholder. The choice was
between wiring the transport to a surface that exists and building a surface
to justify the transport; `CLAUDE.md` settles it — one real consumer beats a
page built for the matrix. `PolicyClaimsTab` was the right one because it
already owns both halves of the contract the interceptors need: a `useFetch`
read whose `AbortSignal` proves cancellation, and a write whose forced-failure
lab toggle proves error normalisation. When `/underwriting` is built it takes
over the burst demo (W4-D3-04) without any of this moving.

**`CLAUDE.md` says "all async goes through `src/shared/api.ts`", and one
surface now does not.** That rule was written when there was one transport.
The Week 4 boundary asks for a second one — the whole point of W4-D3 is to
re-solve the same problem with a library — so the Claims tab's two calls now
go through `src/shared/http` and everything else still goes through `api.ts`.
`api.ts` is not deprecated, not wrapped and not deleted: it keeps the
`use()`/`<Suspense>` cached-promise path (which axios has no equivalent for,
and which W3-D5 depends on), it keeps every other route, and it is the control
group the interceptor stack is read against. The one thing that would have
broken the rule's intent — two copies of the *data* — did not happen: the mock
backend answers from `src/shared/data`, the same single source of truth
`api.ts` reads.

**A sixth lab defect was registered:** `expire-token` in
`src/shared/labs/registry.ts`, documented in `docs/failure-modes.md`. It is
one-shot on purpose — the backend revokes the presented token, answers 401,
and switches the toggle back off — so the demo ends in a *recovery* rather
than in a failure. A toggle that stayed on would 401 the replayed request too,
and the refresh flow would look broken while working correctly.
