# AEGIS — Policy & Claims Console

A demo insurance back-office console built to demonstrate complete coverage
of a React 19 curriculum (Weeks 1–3, plus a completeness tier of every other
hook and API the reference material implies). What the repo contains is the
running app and its tests: ten routes under `src/routes/`, shared hooks,
store, HTTP layer and components under `src/shared/`, and 47 tests in
`*.test.ts(x)` files beside the code they cover.

Weeks 1–3 are hand-rolled on purpose — `useReducer`, `fetch` with
`AbortSignal`, hand-written form state, CSS Modules — and Week 4 re-solves
the same problems with MUI, axios, Redux Toolkit and react-hook-form on a
separate set of routes. Both halves are alive at once so they can be compared;
the mixed styling is the finished state, not a half-done migration. The
[Known gaps](#known-gaps) section below records what is not demonstrable.

This is a competency-demonstration artifact, not a product.

---

## Running it

```
npm install
npm run dev        # Vite dev server
npx vitest run      # full test suite (never --watch: unreliable in WebContainer)
npm run typecheck   # tsc --noEmit
npm run build        # tsc --noEmit && vite build
```

Targets StackBlitz's WebContainer: no Node-only APIs, no filesystem access,
test files are `.test.ts(x)` only.

---

## Route map

| Path | Page | Notes |
|---|---|---|
| `/` | Dashboard | Also where a blocked `/underwriting` redirect explains itself. |
| `/policies` | Policy book | Filter bar, recently-viewed, book/exposure tab switch. The performance story lives here. |
| `/policies/:id` | Policy detail | Header card (`use()`), risk exposure widget, renewal countdown. |
| `/policies/:id` (index) | → Coverage tab | Nested route, no fetch — reads the embedded coverage lines. |
| `/policies/:id/claims` | → Claims tab | `useFetch` + `AbortController`; log a claim from here (optimistic, C-05). |
| `/policies/:id/documents` | → Documents tab | Static seed data. |
| `/quote` | New quote wizard | 4-step `useReducer` state machine, draft persisted to `localStorage`. |
| `/claims/new` | Claim intake | Light page; the real wizard is a component-level lazy chunk loaded on modal open. |
| `/underwriting` | Underwriting | Protected — underwriter role only. |
| `*` | Not found | Catch-all. |

Every route above `App.tsx`'s route table is `React.lazy` with its own
`<Suspense>` and `<ErrorBoundary>` — per route and per widget, never one
boundary at the root, so a chunk that fails to load or a widget that throws
takes down only its own region.

---

## Demo script

The order below is built to show each concept with something already on
screen from the step before it — click through it top to bottom in front of
a reviewer.

1. **Start on `/policies`.** Type in the search box. Point out the console:
   `[render] PolicyRow` lines do not repeat for rows still on screen —
   `React.memo` (W3-D1-01) plus the `useMemo`-wrapped `rateBook`
   (W3-D1-03). Measured on 140 rows: a keystroke that leaves the filtered set
   unchanged logs **zero** `PolicyRow` renders, while the deliberately
   un-memoised `FilterStatus` (W3-D1-06) renders twice on that same
   keystroke; `[rating] rateBook 140 policies in 25.3ms` prints **once** for
   the whole session. Widening the filter back out re-renders only the 139
   rows that actually returned.
2. **Switch to "Exposure by customer" while typing.** The input keeps
   responding — `useTransition` (C-02) — and "Switching…" shows while the
   new view renders in the background.
3. **Filter to something with zero matches, then clear it.** Shows the
   empty state (W1-09) and the `useDeferredValue`-driven "Updating…" flash
   (C-03) as you type back.
4. **Open a policy from the list, then "Recently viewed" on the way
   back.** Confirms `useLocalStorage` (W3-D2-02) survived the round trip.
5. **On the policy detail page**, point out the renewal countdown ticking
   (`setInterval` in a `useRef`-backed hook, W2-D1-04/W2-D2-02) and the risk
   exposure widget rendering successfully — it's about to be the failure
   demo in step 10.
6. **Click between Coverage / Claims / Documents.** Nested routes with
   their own `<Suspense>` per tab (W2-D4-03, W3-D3-03); the URL changes and
   survives a refresh.
7. **On the Claims tab, log a claim.** The modal closes immediately and the
   new row appears labelled "Submitting…" before it's confirmed —
   `useOptimistic` (C-05) — then settles to its real status. Watch it
   scroll into view precisely (`flushSync`, C-10).
8. **Go to `/quote`.** Fill in the applicant step, add a second insured
   party — each "Full name" label targets its own field (`useId`, C-01).
   Watch the sticky premium bar update with no lag as you edit sum insured
   (derived value, not effect-synced state, W2-D1-07) and the "was ₹X" delta
   (previous-value refs, W2-D2-03). Refresh mid-wizard — the draft survives
   (`useReducer` lazy init + `localStorage`, W2-D3-03).
9. **Go to `/claims/new`, open "Start a claim".** The wizard's chunk loads
   only now (component-level `React.lazy`, W3-D3-02) — watch the Network
   tab or the `[chunk]` console log; it is ~50 kB plus a shared ~122 kB of
   Zod, none of which is in the entry chunk. Press Continue on the empty
   Policy step: the error is the *schema's* sentence, raised by
   `trigger(['policyId'])` (`react-hook-form` + `zodResolver`, W4-D5-01…03).
   Pick a policy, then try to claim more than its sum insured — that is a
   cross-field `superRefine`, reported on the amount field. Submit from
   Review: the write goes out through the axios client as a thunk and the
   claim appears under "Filed this session", read back out of the store.
10. **Switch role to Underwriter, then back to Agent.** Visit
    `/underwriting` as each — the protected route (W2-D4-09) blocks the
    agent and explains the redirect (`useLocation`, W2-D4-08); the
    underwriter gets through. As the underwriter, that page is where all
    four Week 4 topics are on screen at once (W4-D5-04): three axios reads
    fired in parallel, the memoised Redux selector behind the exposure
    totals, MUI throughout, and a second `react-hook-form` surface whose
    validation cap came from the server. Tick **"Expire the access token"**
    in the Lab panel, navigate away and back, and watch the console: three
    401s, **one** `POST /auth/refresh`, three replays, and nothing wrong on
    screen (W4-D3-04).
11. **Open the Lab panel** (bottom of any page, dev only) and work through
    the toggle list below — each one has a symptom that only makes sense
    live.
12. **DevTools → Network → offline**, on any page. The connectivity banner
    (`useSyncExternalStore`, C-04) appears immediately; back online, it
    disappears.

---

## Lab toggles

Dev-only panel at the bottom of every route. Each toggle is off by default
and produces one specific, explainable symptom — each one's registration in
`src/shared/labs/registry.ts` says why it is built the way it is.

| Toggle | Matrix ID | Symptom when enabled |
|---|---|---|
| Conditional hook call | W3-D2-01 | Click "Tick" twice — React throws "Rendered more hooks than during the previous render" and the demo (and everything below it) unmounts. Reload to recover. |
| Mutating reducer state | W2-D3-02 | `/quote` → Applicant → "Add insured party" does nothing at first (mutation defeats `Object.is`); switching steps and back makes *two* rows appear instead of one (StrictMode double-invoking the impure reducer). |
| Object-literal effect dependency | W2-D1-05 | The demo's run counter climbs on its own, uncapped conceptually, capped at 500 here so the tab doesn't freeze. |
| Stale closure in an interval | W2-D1-06 | "Last logged" freezes at whatever count existed on mount while "Count" keeps climbing. |
| useEffect instead of useLayoutEffect | W3-D4-04 | On `/quote`, the sticky premium bar visibly starts at the top of the page and jumps down to its docked position a frame later. |
| Third-party risk feed outage | W3-D4-03 | Any policy's risk widget shows a red fallback with Retry; the rest of the page (header, coverage, tabs) keeps working around it. Retry genuinely re-requests (a second `[api] →` line) and fails again — the endpoint is down for good. |
| Claim submission forced to fail | C-05 | Log a claim on any policy — it appears as "Submitting…", then rolls back and a toast reports the rejection. Off, the same row sticks. |

---

## Architecture notes

- `src/shared/` is the import boundary — routes never import from each
  other.
- `BrowserRouter` lives in `src/main.tsx` only.
- All async goes through `src/shared/api.ts`, which deliberately supports
  two paths side by side: an abortable `fetch*` path for `useEffect` (Claims
  tab) and a cached-promise path for `use()` (policy summary, risk widget).
- `src/shared/labs/` holds every deliberate defect, behind a runtime
  toggle that is off by default. Never "fixed" — they're the point.

---

## Known gaps

Five rows of the coverage ledger are not solid, and none of them is fixed by
adding a feature. Four are correct, reachable code whose effect cannot be
observed in this app; the fifth is a concept the app has no honest home for.
A usage invented to carry a checklist row is worth less than an admitted gap —
it survives the question "why is this here?" only as far as the checklist — so
inert is recorded as inert rather than papered over.

**Not built:**

- **`useLayoutEffect` vs `useEffect`.** It lived in the quote wizard's sticky
  premium bar, measuring the header so the bar could dock beneath it. When the
  bar moved from `position: fixed` to `position: sticky`, the measured offset
  stopped being merely invisible and became actively wrong — under `sticky`,
  `top` is the viewport offset the bar clamps at, so the header's ~200px pinned
  it a fifth of the way down the screen over the fields scrolling beneath. The
  measurement and both effect branches were deleted rather than left in the tree
  as dead code, and nothing else in this app must read a rendered dimension
  before paint.
- **`use()` with Context, read conditionally.** The policy summary card read the
  role with `use(AuthContext)` inside its lapsed/cancelled branch; the Redux
  migration deleted `AuthContext`, and `useAppSelector` is a hook, so it cannot
  be called inside a branch. Reading the store through context instead would
  compile and then go stale, because the store reference never changes.

**Qualified — real, correct, and inert:**

- **`memo` with a custom comparator.** The premium badge's comparator can never
  run: its only parent is itself memoised on a referentially stable premium, and
  a parent that bails out never renders its child. The measurement shows it:
  the badge's render count tracks the row's exactly, 140 on mount and zero on
  every keystroke that leaves the filtered set alone. If the comparator did run
  it would lose anyway — two `formatCurrency` calls to skip a render that
  costs one.
- **Context split into state and dispatch.** The split is correct and saves zero
  renders here, because every wizard step reads both halves through the same
  `useQuote()` hook, and the wizard page renders the steps as children of a
  component that reads state — so a state change re-renders them regardless.
- **`useFormStatus`.** The hook is real, correct, reachable, and observable
  nowhere. **This got worse this week, and this repo did it.** Its one
  observable call site was the claim intake wizard, whose submit is now
  `handleSubmit` plus `formState.isSubmitting` — and that swap was not optional,
  because `useFormStatus().pending` is only ever true during a React form
  action, so a form driven by `onSubmit` reports `false` forever no matter where
  the button sits. What remains is the claims-tab form, whose pending state was
  already unobservable for an unrelated reason: the handler closes the modal
  before its `await`, so the form unmounts before `pending` can render. That is
  not fixed by reordering — closing immediately is the correct behaviour there,
  because the optimistic row in the table below is the feedback. The two
  requirements are mutually exclusive and the react-hook-form path wins.

---

## Bundle

Three `vite build` measurements, same machine and config, sizes as reported by
Vite. Two of them are the cost of a static import, and the third is what
splitting looks like when it works.

- **Entry 272.06 → 359.24 kB when the theme landed.** The theme provider is a
  static import in `main.tsx`, so MUI's styling engine, `CssBaseline` and
  Emotion are all reachable from the entry and cannot be lazily chunked. That is
  not tidied away by lazy-loading the provider: the theme must exist before the
  first route renders, or the first paint of every MUI surface is either
  unthemed or a suspended fallback.
- **Entry 359.24 → 527.37 kB when the app shell landed.** Same mechanism, read
  the other way: the shell is imported statically by the layout, so its
  `AppBar`, `Drawer`, `TextField`, `Tooltip`, `List` and icons are reachable
  from the entry too. Nothing here is fixable by lazy-loading the shell either —
  it renders on every route, above the outlet, so deferring it would replace the
  first paint of every page with a fallback. The marginal cost did fall, which
  was the prediction: the dashboard chunk gained a table, four cards and a grid
  container and got *smaller*, because the primitives underneath were hoisted
  into the shared shell.
- **Entry +2.91 kB for `react-hook-form`, Zod and the resolver.** All three are
  reachable only from lazy chunks — nothing above the router imports them — so
  Rollup put Zod in its own shared chunk that two lazy routes pull in and the
  entry does not, and the wizard chunk went 6.38 → 50.41 kB. That is
  route-level splitting doing real work, and it is the exact opposite of what
  happened when MUI arrived.
