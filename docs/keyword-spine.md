# AEGIS — Keyword Spine

One line per concept, **keyword first**. Cover the right-hand column and walk
down: each keyword should pull back the mechanism, the file, and the failure. If
a line does not fire, open that file's header — the header is the long form of
this line, and `docs/qa-drills.md` is the interrogation of it.

Format: `**keyword** · ID — where it lives — what breaks without it`.

Lines marked **⚠** are ones where the honest recall includes a caveat; the
caveat is the part worth remembering, and `docs/qa-drills.md` argues each one.
Six of them correspond to the `[~]` rows in `docs/coverage-matrix.md` — code
that is correct and reachable but demonstrates nothing observable here. The rest
are caveats on rows that are otherwise solid.

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

**useEffect mount-only** · W2-D1-01 — `useFetch` ⚠ — a `[policyId]` effect *is* the mount case on first render; a literal `[]` fetch here would show POL-1's claims forever because Router reuses the instance.
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

**createContext + Provider** · W2-D2-04 — `AuthProvider` — `RequireRole` is not a child of any page and could not receive a drilled prop at all.
**useContext** · W2-D2-05 — `useAuth()` in `RequireRole` — the guarded read; unconditional, so it keeps the missing-provider error.
**Split context** · W2-D2-06 — `QuoteStateContext` / `QuoteDispatchContext` ⚠ — `dispatch` is stable, so a dispatch-only consumer need not re-render on state changes. No such consumer exists here, and the steps lack `React.memo`, so the split is currently inert.
**Guarded context hook** · W2-D2-07 — `useAuth` throws — "must be called within `<AuthProvider>`", not `Cannot read properties of null` three frames into someone else's render.

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
**useMemo context value** · W3-D1-04 — `AuthProvider` ⚠ — stops the provider handing consumers a fresh object identity. In this tree `role` is the only state, so the bail-out branch is unreachable; correct-by-construction rather than currently load-bearing.
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
**React.lazy component** · W3-D3-02 — `ClaimIntakeWizard` inside the modal — works only because `Modal` returns `null` when closed; `<div hidden>` mounts the subtree and downloads the chunk on page load while looking identical.
**Suspense fallback** · W3-D3-03 — eleven boundaries, none at the root — a fallback replaces everything below it, so placement *is* the definition of what disappears.
**Skeleton** · W3-D3-04 — `Skeleton` `table`/`card`/`panel` — a fallback shaped like the page it replaces; only per-route boundaries make that possible, a root one can only spin.
**Preload on intent** · W3-D3-05 — `preloadPath` on `onMouseEnter` **and** `onFocus` — hover alone is an a11y regression: keyboard users would take the slow path on every navigation. Paired log lines are what make it observable rather than plausible.

### Boundaries

**Error boundary class** · W3-D4-01 — `ErrorBoundary` — `getDerivedStateFromError` (render phase, pure) + `componentDidCatch` (commit phase, where `componentStack` lives). No hook equivalent exists.
**Retry = key bump + eviction + reset** · W3-D4-02 — `<Fragment key={attempt}>` + `onRetry` — clearing error state alone re-reads the same cached rejection and re-throws before paint. The key bump discards the *fiber* and **neither cache**: both are module-scoped, so `onRetry` is the half that recovers. Evict *first*, then remount. `clearPolicyResource` for the promise cache; `splitChunk().reset()` for `React.lazy`, whose rejected payload remounting can never reach (measured: 1 import attempt before Retry, 1 after). All three tested.
**Scoped boundary** · W3-D4-03 — `RiskExposurePanel` — the only lab defect whose symptom is that the rest of the page *keeps working*; a boundary at the root catches everything and protects nothing.
**useLayoutEffect vs useEffect** · W3-D4-04 — `StickyPremiumSummary` + `layout-effect-flicker` ⚠ — same value, opposite side of the paint: layout effects re-commit before the first paint, passive effects never do. Trust the `before paint`/`after paint` tag, not the millisecond figure — and *only* the tag: the bar is `position: sticky`, whose `top` is a scroll-triggered clamp this short wizard never reaches, so the toggle produces no visible jump. Volunteer that before being asked. `sticky` is what product wanted; the row was downgraded rather than the CSS reverted to flatter the demo.
**forwardRef** · W3-D4-05 — `Modal` — `TextField` deliberately has none: nothing grabs its node, and `Modal`'s `querySelectorAll` focus search covers it.
**useImperativeHandle** · W3-D4-06 — `{ open, close, focusFirst }` — a verb instead of a variable; the boolean-prop alternative duplicates open/close state at every trigger site and re-renders the parent's whole subtree.

### `use()` and Suspense-for-data

**use(promise)** · W3-D5-01 — `PolicySummaryCard` — no loading state, no error state, `detail` not nullable; a render that reaches line one already has the data.
**Cached promise** · W3-D5-02 — `getPolicyResource` — `use(fetch(id))` calls fetch *during render*, so settle → re-render → new promise → suspend, forever. One `[api] →` against many `⤳ cache hit` is the proof.
**use(Context) conditionally** · W3-D5-03 — `use(AuthContext)` inside the lapsed/cancelled branch — `useContext` subscribes every card permanently, so a role switch re-renders the ~85% that never show the reinstatement note.
**Suspense + boundary** · W3-D5-04 — `RiskExposurePanel` — the same rejected promise goes through both in sequence: pending → Suspense, rejected → boundary. Boundary *outside*, or the rejection has nowhere to land.
**Lazy refactor** · W3-D5-05 — `App.tsx` — before splitting, a broken route import failed the build; after, it builds, deploys, and breaks exactly one page. `App.test.tsx` is that click-through, automated.

---

## React 19 completeness tier

**useId** · C-01 — `TextField` — three insured parties with a hard-coded `id` means three inputs sharing one id and three labels all pointing at the first.
**useTransition** · C-02 — `PoliciesPage.handleViewChange` — the click is urgent, the render it causes is not; `isPending` is the price of keeping stale content on screen, and `PolicyBookTabs` exists to pay it.
**useDeferredValue** · C-03 — `usePolicyFilters` `deferredQuery` — defers a *value* whose source must stay urgent; `useTransition` marks an *update you own*. Same idea, opposite ends.
**useSyncExternalStore** · C-04 — called directly in `ConnectivityBanner` — the `useState`+`useEffect` mirror can disagree with the store mid-render under concurrency. `getServerSnapshot` returns `true` so the offline banner never renders into server HTML. ⚠ `labs/registry.ts` is the same shape and deliberately still uses the mirror.
**useOptimistic** · C-05 — `PolicyClaimsTab` — the overlay is *derived* from `claims`, so there is no removal step on failure to get wrong. Only applies inside a transition — it works here because the form action supplies one.
**useActionState** · C-06 — `ClaimIntakeWizard` (validated ahead, one error slot) and `ClaimForm` (validated from `FormData`, per-field errors) — the same hook two genuinely different ways. ⚠ the wizard's `<form>` contains no fields.
**useFormStatus** · C-07 — `SubmitButton`, `WizardNavButton`, `FormCancelButton` ⚠ — must be a *descendant* of the form, never the component that renders it. Real in the wizard; unobservable in `ClaimForm`, where the modal closes and unmounts the form before pending can render.
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
