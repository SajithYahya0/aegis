# AEGIS — Policy & Claims Console

A demo insurance back-office console built to demonstrate complete coverage
of a React 19 curriculum (Weeks 1–3, plus a completeness tier of every other
hook and API the reference material implies). See `docs/coverage-matrix.md`
for the full concept-by-concept ledger, `docs/failure-modes.md` for what
breaks without each piece, and `docs/render-counts.md` for measured proof of
the memoisation story.

This is a competency-demonstration artifact, not a product — read
`CLAUDE.md` before changing anything.

---

## Running it

```
npm install
npm run dev        # Vite dev server
npx vitest run      # full test suite (never --watch — see CLAUDE.md)
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
`<Suspense>` and `<ErrorBoundary>` — see `docs/failure-modes.md` for
W3-D3-01 through W3-D5-05.

---

## Demo script

The order below is built to show each concept with something already on
screen from the step before it — click through it top to bottom in front of
a reviewer.

1. **Start on `/policies`.** Type in the search box. Point out the console:
   `[render] PolicyRow` lines do not repeat for rows still on screen —
   `React.memo` (W3-D1-01) plus the `useMemo`-wrapped `rateBook`
   (W3-D1-03). `docs/render-counts.md` has the exact measured numbers for
   this exact interaction.
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
   (`usePrevious`, W2-D2-03). Refresh mid-wizard — the draft survives
   (`useReducer` lazy init + `localStorage`, W2-D3-03).
9. **Go to `/claims/new`, open "Start a claim".** The wizard's chunk loads
   only now (component-level `React.lazy`, W3-D3-02) — watch the Network
   tab or the `[chunk]` console log. Step through to Review and submit —
   `useActionState` for the action, `useFormStatus` for the button's
   pending state (C-06, C-07).
10. **Switch role to Underwriter, then back to Agent.** Visit
    `/underwriting` as each — the protected route (W2-D4-09) blocks the
    agent and explains the redirect (`useLocation`, W2-D4-08); the
    underwriter gets through.
11. **Open the Lab panel** (bottom of any page, dev only) and work through
    the toggle list below — each one has a symptom that only makes sense
    live.
12. **DevTools → Network → offline**, on any page. The connectivity banner
    (`useSyncExternalStore`, C-04) appears immediately; back online, it
    disappears.

---

## Lab toggles

Dev-only panel at the bottom of every route. Each toggle is off by default
and produces one specific, explainable symptom — full detail (including why
each one is built the way it is) is in `docs/failure-modes.md` and
`src/shared/labs/registry.ts`.

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
  toggle, documented in `docs/failure-modes.md`. Never "fixed" — they're the
  point.
