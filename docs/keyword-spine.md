# AEGIS — Keyword Spine

One line per concept, **keyword first**. Cover the right-hand column and walk
down: each keyword should pull back the mechanism, the file, and the failure. If
a line does not fire, open that file's header — the header is the long form of
this line, and `docs/qa-drills.md` is the interrogation of it.

Format: `**keyword** · ID — where it lives — what breaks without it`.

Lines marked **⚠** are ones where the honest recall includes a caveat; the
caveat is the part worth remembering, and `docs/qa-drills.md` argues each one.
Three of them correspond to the `[~]` rows in `docs/coverage-matrix.md` — code
that is correct and reachable but demonstrates nothing observable here. The rest
are caveats on rows that are otherwise solid. (It read "six" until Week 4 Day 5,
which closed three of them by building the surfaces they were waiting for and
made a fourth — C-07 — worse.)

---

## Week 1 — Fundamentals

**JSX / fragments** · W1-01 — `FilterStatus` — `<>…</>` in both ternary branches; a wrapper `<div>` inside `<p>` is invalid nesting the browser silently reopens.
**Composition** · W1-02 — `PoliciesPage → PolicyList → PolicyRow` — memoisation needs a component boundary to bail out at; one inline `.map` has none.
**Typed props** · W1-03 — `PolicyRowProps`, `types.ts` — one `Policy` type per domain, or two routes spell `cancelled`/`canceled` and the filter silently returns zero rows.
**useState primitive** · W1-04 — `usePolicyFilters` `rawQuery` — the urgent, every-keystroke value; everything else on /policies is derived from it.
**useState immutable update** · W1-05 — `PoliciesPage.handleSelect` — dedupe + cap by rebuilding the array; mutating it means `Object.is` sees no change and nothing re-renders.
**useState functional updater** · W1-06 — `setRecentIds(prev => …)` — two rapid selects both read the same stale snapshot otherwise, and the second write erases the first.
**useState lazy init** · W1-07 — `useLocalStorage` — `useState(read())` runs the `getItem` + `JSON.parse` on *every* render; `useState(() => read())` runs it once.
**key** · W1-08 — `PolicyList` `key={policy.id}` — index keys make React reuse the wrong row's DOM and state when the filtered set changes.
**Conditional rendering** · W1-09 — `PoliciesPage` (`&&`), `FilterStatus` (ternary), `PolicyList` (early return) — three shapes, three reasons: presence, either/or, and bail-out-before-the-table.
**Event handlers** · W1-10 — `PolicyFilterBar` — typed `ChangeEvent<HTMLInputElement>`; the untyped version compiles and hands you `any` at the one place a typo costs a silent no-op.
**Controlled inputs** · W1-11 — `QuoteWizardPage` steps — value from `useQuote()`'s state, change through its `dispatch`; the draft in state is always exactly what is on screen.
**CSS Modules** · W1-12 — `PolicyRow.module.css` + `STATUS_CLASS` — a template-literal `status-${x}` class is invisible to Modules' scoping and every status badge renders colourless.
**Lifting state up** · W1-13 — `usePolicyFilters` owns it, `PoliciesPage` distributes — filter state read by the list, the summary line and the URL at once.
**children / slots** · W1-14 — `Panel` — the wrapper knows chrome, not content; without it every panel's border logic is copy-pasted per page.

---

## Week 2 — Effects, refs, context, reducers, routing

### Effects

**useEffect mount-only** · W2-D1-01 — `UnderwritingPage` (`useFetch(…, [])`) — its three reads depend on nothing the component can change, so `[]` is correct there. Contrast one hook away: `PolicyClaimsTab` passes `[policyId]` because Router reuses the tab instance across `:id` changes, and a literal `[]` there would show POL-1's claims forever. No longer ⚠ — the row was qualified until a page existed that genuinely fetches once.
**useEffect dependency-driven** · W2-D1-02 — `useFetch(fetcher, [policyId])` — deps are the caller's contract for "what should trigger a refetch"; the fetcher itself is held in a ref so it stays out of them.
**AbortController cleanup** · W2-D1-03 — `useFetch` cleanup — two in-flight requests race; whichever settles second wins, unrelated to what the URL now says.
**Interval cleanup** · W2-D1-04 — `useRenewalCountdown` — no `clearInterval` and five visited policies leave five countdowns ticking against unmounted components.
**Object-literal dep** · W2-D1-05 — `EffectDepsDemo` (lab) — a `{…}` in deps is never `Object.is`-equal, so effect → setState → render → new object → effect, forever. Capped at 500 here.
**Stale closure** · W2-D1-06 — `StaleClosureDemo` (lab) — `setInterval` in a `[]` effect captures the mount render's `count` and never sees another.
**Derived not effect** · W2-D1-07 — `estimateIndicativePremium` called in render — the `useState`+`useEffect` pair renders every edit twice, the first with the pre-edit value.

### Refs

**useRef DOM** · W2-D2-01 — `Modal` `containerRef` + `focusFirst()` — focus the first field on open, restore it to the trigger on close; without the restore, focus lands on `<body>`.
**useRef mutable** · W2-D2-02 — `useRenewalCountdown` `lastActivityRef` — written on every mousemove; as state, an idle detector re-renders the page dozens of times a second while the user is idle. The rule: ref when write frequency ≠ render frequency, state when they match, **neither** when a closure variable already scopes it — which is why the old `timerRef` was deleted.
**Previous-value refs** · W2-D2-03 — `currentPremiumRef` / `previousPremiumRef` in `StickyPremiumSummary` — refs written during render, so "was ₹X" is available in the render that shows it; the effect version flashes the wrong value for one frame.

### Context

**createContext + Provider** · W2-D2-04 — `QuoteProvider`, `ThemeModeProvider` — rehomed from `AuthProvider`, which the Redux migration deleted (W4-D4-01). MUI reads the theme from a provider or not at all.
**useContext** · W2-D2-05 — `useQuote()` in the wizard steps, `useThemeChoice()` in `AppShell` — the guarded reads; unconditional, so they keep the missing-provider error.
**Split context** · W2-D2-06 — `QuoteStateContext` / `QuoteDispatchContext` ⚠ — `dispatch` is stable, so a dispatch-only consumer need not re-render on state changes. No such consumer exists here, and the steps lack `React.memo`, so the split is currently inert.
**Guarded context hook** · W2-D2-07 — `useQuote` / `useThemeChoice` throw — "must be called within a `<QuoteProvider>`", not `Cannot read properties of null` three frames into someone else's render. `useAuth` kept its name over `useAppSelector`; react-redux raises that error itself now.

### Reducers

**useReducer** · W2-D3-01 — `quoteReducer` — one switch listing every legal transition; `SET_TYPE` also clearing coverage codes is a rule that belongs there, not in an `onChange`.
**Reducer purity** · W2-D3-02 — `mutating-reducer` (lab) — push + return `state` means `Object.is` bails out and nothing renders; StrictMode's double-invoke then shows *two* rows, because mutation really happens twice.
**useReducer lazy init** · W2-D3-03 — `initQuoteDraft` as the third argument — the second argument is evaluated every render and discarded; the third runs once, on mount.
**Reducer + context as store** · W2-D3-04 — `QuoteProvider` on `/quote` only — scoped to a route with one cohesive draft, which is the case where "context is not a state manager" does not apply.

### Routing

**BrowserRouter** · W2-D4-01 — `main.tsx`, once — a second Router does not error: the inner one wins below it while the outer owns `window.history`, so links update the URL and the route snaps back.
**Routes / Route / index** · W2-D4-02 — `App.tsx` — the only URL→component map; nested routes need a parent to inherit layout and `<Outlet>` from.
**Nested routes + Outlet** · W2-D4-03 — `PolicyDetailPage` — tabs as routes, so `/policies/POL-12/claims` is a real shareable address instead of client state nobody else can see.
**NavLink active** · W2-D4-04 — `AppLayout` — one copy of the active-link rule; per-page copies drift and each page disagrees about which link is current.
**useParams** · W2-D4-05 — `PolicyDetailPage`, both tabs — the id comes from the URL, which is why a reload lands on the same policy.
**useNavigate replace** · W2-D4-06 — `RequireRole` ⚠ — `replace` keeps the blocked URL out of history so Back does not bounce. Redirecting from an effect rather than `<Navigate>` is the weaker half; `<Navigate>` is the better form.
**useSearchParams** · W2-D4-07 — `usePolicyFilters` — the URL is the source of truth for filters, so a filtered view is a link.
**useLocation** · W2-D4-08 — `RequireRole` writes `state.attemptedPath`, `DashboardPage` reads it — without the read, the redirect state is inert and the bounce has no explanation.
**Protected route** · W2-D4-09 — `RequireRole` wrapper — an agent who *types* `/underwriting` must be turned away, not just one who cannot see the link.
**404 catch-all** · W2-D4-10 — `path="*"` → `NotFoundPage` — an unmatched route renders nothing at all otherwise, which looks like a crash.

---

## Week 3 — Performance, splitting, boundaries, `use()`

### Memoisation

**React.memo** · W3-D1-01 — `PolicyRow` — 140 rows re-executing on every keystroke; with the memo, zero for keystrokes that leave the set unchanged (measured, `docs/render-counts.md`).
**Custom comparator** · W3-D1-02 — `PremiumBadge` ⚠ — compares formatted strings, not raw amounts. Never actually runs: its memoised parent bails out first, and the comparator costs two `Intl` calls to skip a render costing one.
**useMemo expensive** · W3-D1-03 — `rateBook` in `PoliciesPage` — keyed on the *whole book*, never on `filtered`; keying on `filtered` makes it cheaper as you type (inverting the claim) and hands every visible row a new `premium` object.
**useMemo provider value** · W3-D1-04 — `ThemeModeProvider`'s `theme` — stops `ThemeProvider`, which compares by identity, handing every `styled()` and `sx` consumer in the app a fresh theme. Bail-out is reachable: Dark → System on a light machine changes `choice` but not `mode`. Rehomed from `AuthProvider` (deleted, W4-D4-01) and upgraded from ⚠.
**useCallback** · W3-D1-05 — `handleSelect` — a new `onSelect` identity every render defeats `PolicyRow`'s memo via a different prop; deps are `[setRecentIds]`, stable because `useLocalStorage` returns the raw setter.
**When NOT to memoise** · W3-D1-06 — `FilterStatus` — props derive from `rawQuery` and are new on every render that reaches it; a comparator would report "changed" every time and cost extra.

### Custom hooks

**Rules of hooks** · W3-D2-01 — `ConditionalHookDemo` (lab) — React counts hook calls at runtime, so the crash lands on the render where the count changes, not where the `if` was written.
**useLocalStorage** · W3-D2-02 — recently-viewed on /policies — lazy init, `try/catch` around `JSON.parse` (a corrupted value would crash the initial render), write-back effect.
**useDebounce** · W3-D2-03 — the /policies search box — guards the *URL write*, so a link copied mid-type is not `?q=acc`.
**useFetch** · W3-D2-04 — Claims tab — fetcher in a ref so it stays out of the caller's deps; `{data, error, loading}` so "pending" is distinguishable from "genuinely empty".
**Hook composition** · W3-D2-05 — `usePolicyFilters` — URL + debounce + deferred + memo in one unit; inline in the page, the second consumer either duplicates it or forces props the page does not use.
**Testing a hook** · W3-D2-06 — `useDebounce.test.ts`, `useLocalStorage.test.ts` — fake timers, because a real 300ms wait per assertion is a suite nobody runs.
**Testing a component** · W3-D2-07 — `PolicyList.test.tsx`, `ErrorBoundary.test.tsx`, `App.test.tsx` — the boundary tests pin the retry semantics that pass every manual check while recovering nothing.

### Code splitting

**React.lazy routes** · W3-D3-01 — `lazyRoutes.tsx` — seven top-level routes plus three tabs, each its own chunk; `rating.ts` left the entry chunk, `shared/data` did not (⚠ `AppLayout` imports `AS_OF`, and one static import pins the graph below it).
**React.lazy component** · W3-D3-02 — `ClaimIntakeWizard` inside MUI's `Dialog` — works only because `Dialog` renders nothing while `open` is false; `keepMounted` (or `<div hidden>`, which is what the app's own `Modal` deliberately is not) mounts the subtree and downloads the chunk on page load while looking identical. The container changed in Week 4 Day 5 and the property did not.
**Suspense fallback** · W3-D3-03 — eleven boundaries, none at the root — a fallback replaces everything below it, so placement *is* the definition of what disappears.
**Skeleton** · W3-D3-04 — `Skeleton` `table`/`card`/`panel` — a fallback shaped like the page it replaces; only per-route boundaries make that possible, a root one can only spin.
**Preload on intent** · W3-D3-05 — `preloadPath` on `onMouseEnter` **and** `onFocus` — hover alone is an a11y regression: keyboard users would take the slow path on every navigation. Paired log lines are what make it observable rather than plausible.

### Boundaries

**Error boundary class** · W3-D4-01 — `ErrorBoundary` — `getDerivedStateFromError` (render phase, pure) + `componentDidCatch` (commit phase, where `componentStack` lives). No hook equivalent exists.
**Retry = key bump + eviction + reset** · W3-D4-02 — `<Fragment key={attempt}>` + `onRetry` — clearing error state alone re-reads the same cached rejection and re-throws before paint. The key bump discards the *fiber* and **neither cache**: both are module-scoped, so `onRetry` is the half that recovers. Evict *first*, then remount. `clearPolicyResource` for the promise cache; `splitChunk().reset()` for `React.lazy`, whose rejected payload remounting can never reach (measured: 1 import attempt before Retry, 1 after). All three tested.
**Scoped boundary** · W3-D4-03 — `RiskExposurePanel` — the only lab defect whose symptom is that the rest of the page *keeps working*; a boundary at the root catches everything and protects nothing.
**useLayoutEffect vs useEffect** · W3-D4-04 — **not built `[ ]`; volunteer this** — the concept is real (layout effects re-commit before the first paint, passive effects never do) but it is not in this app. `StickyPremiumSummary` carried it until the premium bar moved to `position: sticky`, where `top` stopped being a draw position and became a pin offset — the measured ~200px then clamped the bar over the fields beneath it. Offset moved into CSS, and the measurement, both branches and the `layout-effect-flicker` toggle went with it rather than staying as dead code. Nothing was built to replace it: no screen here needs a rendered dimension before paint, and a component invented to host the row is what `CLAUDE.md` calls worse than the gap.
**forwardRef** · W3-D4-05 — `Modal` — `TextField` deliberately has none: nothing grabs its node, and `Modal`'s `querySelectorAll` focus search covers it.
**useImperativeHandle** · W3-D4-06 — `{ open, close, focusFirst }` — a verb instead of a variable; the boolean-prop alternative duplicates open/close state at every trigger site and re-renders the parent's whole subtree.

### `use()` and Suspense-for-data

**use(promise)** · W3-D5-01 — `PolicySummaryCard` — no loading state, no error state, `detail` not nullable; a render that reaches line one already has the data.
**Cached promise** · W3-D5-02 — `getPolicyResource` — `use(fetch(id))` calls fetch *during render*, so settle → re-render → new promise → suspend, forever. One `[api] →` against many `⤳ cache hit` is the proof.
**use(Context) conditionally** · W3-D5-03 ✗ **not built** — was `use(AuthContext)` inside the lapsed/cancelled branch; the Redux migration (W4-D4-01) deleted the Context and `useAppSelector` cannot be called in a branch. `use(ReactReduxContext)` would compile and go stale. Cost of the gap: one re-render of one card per role switch.
**Suspense + boundary** · W3-D5-04 — `RiskExposurePanel` — the same rejected promise goes through both in sequence: pending → Suspense, rejected → boundary. Boundary *outside*, or the rejection has nowhere to land.
**Lazy refactor** · W3-D5-05 — `App.tsx` — before splitting, a broken route import failed the build; after, it builds, deploys, and breaks exactly one page. `App.test.tsx` is that click-through, automated.

---

## Week 4 — MUI, theming, axios, Redux Toolkit, react-hook-form

Placed after Week 3 rather than at the end of the file, so the four "week"
sections stay contiguous and the completeness tier stays last.

### Theming and layout

**ThemeProvider + CssBaseline** · W4-D1-01 — `ThemeModeProvider`, mounted in `main.tsx` *outside* `BrowserRouter` — `sx`, `styled()` and `palette.status` are all reads off the theme context; below the router the theme would remount per navigation and portalled content would miss it entirely.
**MUI core components** · W4-D1-02 — `AppBar`/`TextField` (`AppShell`), `Card`/`Table` (`/dashboard`, `/underwriting`), `Dialog` (`ClaimIntakePage`), `Button` (wizard `DialogActions`, `DecisionForm`) — all six now, and each waited for a page that wanted it rather than being rendered to close the row.
**Grid2 / Box / Stack** · W4-D1-03 — one `Grid` container per page, not one per row — per-row containers make the vertical gutter a different number from the horizontal one, and nothing in the build says so.
**Theme breakpoints, not media queries** · W4-D1-04 — `size={{ xs, sm, md }}` and `sx={{ display: { xs: 'none', md: 'table-cell' } }}` — hand-written queries drift from `theme.breakpoints` into a band of widths where the nav has collapsed and the content has not.
**createTheme + custom `status` key** · W4-D2-01 — `theme.ts` `palette.status`, typed by `mui-augment.d.ts` — ⚠ the file is *not* `theme.d.ts`: TypeScript's wildcard matcher drops a `.d.ts` beside a `.ts` of the same basename, so the augmentation was in the repo and not in the program.
**Typography / defaultProps / styleOverrides** · W4-D2-02 — `theme.ts` — `body1` is overridden for correctness, not house style: `CssBaseline` spreads it onto `body` after `global.css`, so MUI's 1rem would become the base size for the CSS Modules routes too.
**Three-state theme toggle** · W4-D2-03 — `AppShell`'s `IconButton` → `useLocalStorage` → `matchMedia` — Light → Dark → **System**, because a two-state button makes the first click a one-way door out of "follow my OS".
**styled()** · W4-D2-04 — `StatusChip` on /dashboard, /underwriting and the wizard's review step — reused, and varies by `PolicyStatus`; `shouldForwardProp` is what keeps `status` out of the DOM, where React tolerates it silently.
**sx** · W4-D2-05 — `DashboardPage`, `AppShell`, `UnderwritingPage` — one-off, local, no variant axis. The rule the pair demonstrates: `styled()` when reused or varying, `sx` when used once in one place.

### axios

**Instance + baseURL** · W4-D3-01 — `http` in `client.ts`, composed in `store/index.ts` — mocked at the *adapter*, not at the endpoint functions, so every request is dispatched by axios for real and every interceptor genuinely runs.
**Request interceptor — token attach** · W4-D3-02 — interceptor (a) — reads `store.getState().auth.token`, skips `/auth/*` (or the login waits on itself), and owns the single-flight session bootstrap. Module state, not Context: an interceptor registered at module load has no component to call `useContext` from.
**Response interceptor — logging + normalisation** · W4-D3-03 — interceptors (b) and (c) — four failure shapes (status, no-response, cancel, non-axios throw) become one `ApiError`, preferring the server's own `code`/`message` over "Request failed with status code 503".
**401 single-flight + `_retry` guard** · W4-D3-04 — `refreshOnce()` — the queue *is* the promise; each waiter is already parked in its own `await`. Clickable on `/underwriting`: three parallel reads, three 401s, one refresh, three replays. A replay that 401s again finds `_retry` set and is normalised instead of refreshed.
**Cancellation through axios** · W4-D3-05 — `endpoints.ts` passes `config.signal`; `mockBackend`'s `delay()` listens for it — `axios-mock-adapter` ignores `config.signal` entirely, so without that listener the abort is a no-op at the transport and the stale response still arrives.

### Redux Toolkit

**configureStore + typed hooks** · W4-D4-01 — `useSelector.withTypes<RootState>()` — derived, not cast: a cast keeps type-checking against a dispatch signature the store no longer has, and erases the return type `.unwrap()` needs.
**createSlice + Immer** · W4-D4-02 — `switchRole`, `logout`, `clearSubmitted` — the mutation is safe *because* Immer returns a new object; a reducer that really mutated would leave `Object.is` answering "unchanged" and nothing on screen would move. Deliberately the opposite style to `quoteReducer` one folder away.
**createAsyncThunk + extraReducers** · W4-D4-03 — `loginThunk`, `refreshThunk`, `submitClaimThunk` — all three lifecycle actions handled, not just `fulfilled`: `pending` is what locks the role switcher against a second in-flight switch, `rejected` is what stops a dead session reporting itself healthy.
**Two slices, not one** · W4-D4-01 — `auth` + `claims` — `logout` writes every `AuthState` field out by hand so nothing survives it; a combined slice would put the agent's record of what they filed inside that blast radius.
**createSelector** · W4-D4-04 — `selectExposureByCustomer` — un-memoised, it re-prices the whole book on every `auth/*` action, because a fresh array can never pass `Object.is`. `selectRole`/`selectIsUnderwriter` are deliberately **not** memoised — reference equality on a primitive already is value equality.
**Context retained beside the store** · W4-D4-05 — `<Provider store>` and `<QuoteProvider>` eight lines apart in `main.tsx` — the wizard draft stays on Context + `useReducer` so the two answers to "shared state" can be read against each other in one running app.

### react-hook-form + Zod

**useForm + register + Controller** · W4-D5-01 — `ClaimIntakeWizard`, `DecisionForm` — `register` needs a native element whose `ref` carries the value. `Autocomplete`'s ref is its *search* input, MUI `Select`'s reaches a `div`, and a `Checkbox`'s value is `checked` — three different reasons, one silent symptom: the field reads `undefined` and validation rejects what the user can see on screen.
**zodResolver + z.infer** · W4-D5-02 — `claimSchema.ts`, `decisionSchema.ts` — the type is `z.infer` of the schema, so there is nothing to drift from. The interface this replaced had already drifted: `amount: number` against an input producing a string.
**Cross-field refine** · W4-D5-02 — `superRefine` with an explicit `path` — ⚠ the path is the load-bearing part. Left to default to the object root, the issue is raised, the per-step `trigger(['amount'])` never matches it, and an over-limit claim reaches the review screen. ⚠ also: Zod 4 runs the object check even while a field-level rule is failing — the opposite of Zod 3, measured and pinned in `claimSchema.test.ts` after this header claimed the Zod 3 behaviour.
**Schema factory** · W4-D5-02 — `makeDecisionSchema(maxLoadingPct)` — the cap comes from `GET /underwriting/limits` at run time, so it cannot be a module-level schema. Hard-coded, the form accepts 45%, the endpoint refuses it, and the message names a rule the screen never mentioned.
**formState + per-step trigger** · W4-D5-03 — `goNext()` awaits `trigger(STEP_FIELDS[step])` — `mode: 'onBlur'` + `reValidateMode: 'onChange'` is strict on the way in and forgiving on the way out. Submit is `!isDirty || isSubmitting`: without the first the only possible outcome of the first click is a failing request, without the second a double-click files two claims.
**isValid, deliberately not disabling** · W4-D5-03 — wizard Continue, `DecisionForm` — it drives a variant and a caption, not `disabled`; a gate that goes dead gives the user no way to find out which field is wrong.
**root errors** · W4-D5-03 — `setError('root.submit', …)` / `setError('root.server', …)` — the failure belongs to the *request*, not to any one input, and RHF clears `root` on the next submit where a `useState` slot would not.
**Integrated surface** · W4-D5-04 — `/underwriting` — theming, three parallel axios reads, the memoised Redux selector and an RHF form on one screen. The parallelism is what makes W4-D3-04 clickable, and `UnderwritingPage.test.tsx` is the only test that renders this route at all — `App.test.tsx` runs as an `agent` and can only assert it is *absent*.
**RHF vs controlled** · W4-D5-01 — `ClaimIntakeWizard` against `QuoteWizardPage` — twelve `useState` calls became zero, and every keystroke stopped re-rendering ten sibling inputs. The wizard *wants* that; `/quote` wants the opposite, because it recalculates a live premium on every render. Controlled state is for when every render needs the value.
**What it cost** · W4-D5-01 ⚠ — `useActionState` and `useFormStatus` were the wizard's before this. C-06 repointed to `PolicyClaimsTab` and is fine; **C-07 lost its only observable call site**, because `useFormStatus().pending` is only ever true inside a React form action and `handleSubmit` is not one. Volunteer this — it is the one row Week 4 Day 5 made worse.

---

## React 19 completeness tier

**useId** · C-01 — `TextField` — three insured parties with a hard-coded `id` means three inputs sharing one id and three labels all pointing at the first.
**useTransition** · C-02 — `PoliciesPage.handleViewChange` — the click is urgent, the render it causes is not; `isPending` is the price of keeping stale content on screen, and `PolicyBookTabs` exists to pay it.
**useDeferredValue** · C-03 — `usePolicyFilters` `deferredQuery` — defers a *value* whose source must stay urgent; `useTransition` marks an *update you own*. Same idea, opposite ends.
**useSyncExternalStore** · C-04 — called directly in `ConnectivityBanner` — the `useState`+`useEffect` mirror can disagree with the store mid-render under concurrency. `getServerSnapshot` returns `true` so the offline banner never renders into server HTML. ⚠ `labs/registry.ts` is the same shape and deliberately still uses the mirror.
**useOptimistic** · C-05 — `PolicyClaimsTab` — the overlay is *derived* from `claims`, so there is no removal step on failure to get wrong. Only applies inside a transition — it works here because the form action supplies one.
**useActionState** · C-06 — `ClaimForm` in `PolicyClaimsTab` (validated from `FormData`, real per-field errors) — the action owns the async call and the error state, not an `onClick`. Repointed in Week 4 Day 5: the wizard was the second call site and now submits through `react-hook-form` instead. The one that stayed was always the more interesting of the two.
**useFormStatus** · C-07 — `SubmitButton`, `FormCancelButton`, both inside `ClaimForm` ⚠⚠ — must be a *descendant* of the form, never the component that renders it, **and** the form must have an `action`: `pending` is only ever true inside a React form action, so `onSubmit` — including `react-hook-form`'s `handleSubmit` — reports `false` forever. That is why the wizard could not keep it. Its remaining call site was already unobservable (`handleLogClaim` closes the modal before its `await`), so this hook is now correct, reachable, and observable nowhere. Volunteer this.
**useDebugValue** · C-08 — `useLocalStorage` — labels the hook in DevTools; without it, N `useLocalStorage` calls are N anonymous "State" entries.
**createPortal** · C-09 — `Modal`, `Toast` → `#modal-root` — `position: fixed` inside a `transform`ed ancestor (which `Panel` creates) positions against that ancestor, not the viewport.
**flushSync** · C-10 — `PolicyClaimsTab.handleLogClaim` — forces the DOM to catch up before the next line, so `lastRowRef` points at the row that was just appended rather than the one before it. Opts out of batching — right on a dozen claims, wrong on 140 policies.
**startTransition standalone** · C-11 — `usePolicyFilters`'s debounced URL commit — fires from an effect, not a handler, so there is no pending flag to show; an update originating from a timer has no claim to urgency.
**memo × useMemo proof** · C-12 — `docs/render-counts.md` — measured, not estimated: 140 rows at mount, **0** on keystrokes that leave the set unchanged, 1 `rateBook` for the whole session.

---

## Mechanisms with no matrix row of their own

**StrictMode double-invoke** — `main.tsx` — not noise: it is the check that every cleanup works, and the impurity detector that makes the mutating-reducer defect show *two* rows.
**Promise-cache eviction** — `clearPolicyResource` ⚠ — also clears `riskFeedCache`, which the name does not say; eviction scope should match boundary scope or the boundary is not containing what it claims to.
**Identity churn** — the recurring bug class — `premiums` keyed on `filtered`, `onSelect` without `useCallback`, `Toast`'s `onDismiss` once in its effect deps (fixed: held in a ref, effect keys on `message`). Same signature every time: something looks broken downstream, cause is an identity changing upstream for unrelated reasons.
**Chunk reset** — `splitChunk().reset()` — nulls `pending` **and** re-creates the `lazy()`; `Component` is a wrapper reading the current one at render time, or the route table's element captures the stale lazy object and reset swaps a variable nothing reads. Three parts, all required.
**Lazy-chunk test budget** — `App.test.tsx` `CHUNK_TIMEOUT_MS` — under Vitest there is no pre-built bundle, so a lazy import transforms its whole module graph on demand (~600ms) before 140 rows render (~350ms). The 1000ms default was measuring the wrong thing.
**Lab toggles** — `labs/registry.ts` — module state + subscribe/notify, not context, because the conditional-hook demo breaks the rules of hooks and a `useContext` next to that cannot be trusted. Dev-only via `import.meta.env.DEV`.
