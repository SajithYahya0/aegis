# AEGIS — Policy & Claims Console

An internal broker/underwriter console for an insurance book: browse and filter
policies, open a policy and read its cover and claims, build an indicative
quote, file a first notice of loss, and — as an underwriter — work a referral
queue and record decisions.

React 19 + Vite + TypeScript, MUI for everything visual, Redux Toolkit for the
session, axios for transport. The "server" is `axios-mock-adapter`, so the
whole app talks to a real HTTP layer with real latency, real 401s and real
aborts; only the socket is missing.

## Running it

```
npm install
npm run dev         # Vite dev server
npm test            # vitest run
npm run typecheck   # tsc --noEmit
npm run build       # tsc --noEmit && vite build
```

## Structure

```
src/
  main.tsx                    composition root: mock backend, interceptors, providers
  App.tsx                     route table, lazy chunks, role guard, route error boundary
  shared/
    domain.ts                 types, formatters, enum labels
    data.ts                   12 households expanded to a 240-policy book, 10 claims
    rating.ts                 cover catalogue + the premium calculation
    ThemeModeProvider.tsx     the MUI theme plus light / dark / system, persisted
    AppShell.tsx              app bar, nav drawer, role switch, error toast
    ErrorBoundary.tsx         retry remounts children under a fresh key
    hooks.ts                  useDebounce, useLocalStorage
    http/
      client.ts               axios instance + endpoint functions
      interceptors.ts         auth header, 401 refresh + replay, error toast state
      mockSession.ts          latency, token issue, access expiry, refresh rotation
      mockBackend.ts          the resource routes
    store/
      index.ts                store wiring and typed hooks
      authSlice.ts            session, role, login/refresh thunks
      claimsSlice.ts          claims filed this session
  routes/
    DashboardPage.tsx         metrics, renewals due, claims filed this session
    PoliciesPage.tsx          search, filters in the URL, sortable 240-row book
    PolicyBook.tsx            the filter bar and one memoised row
    PolicyDetailPage.tsx      policy header + nested tab routes; throws on a failed load
    PolicyTabs.tsx            cover lines, claims on the policy
    QuoteContext.tsx          wizard draft reducer + provider
    QuoteWizardPage.tsx       four-step quote: stepper, validation, navigation
    QuoteSteps.tsx            the fields for each step
    StickyPremiumSummary.tsx  fixed premium bar, measured before paint
    ClaimIntakePage.tsx       claim form, two steps
    ClaimIncidentStep.tsx     incident fields, focuses the first invalid one
    claimSchema.ts            Zod rules for a claim
    UnderwritingPage.tsx      referral queue
    UnderwritingDecisionForm.tsx  decision form, limits come from the server
```

## Where each idea lives

| Concept | File |
|---|---|
| useState, lists, keys, conditionals | `PoliciesPage.tsx` |
| useEffect + cleanup (abort) | `PoliciesPage.tsx` search effect |
| useRef (DOM) | `StickyPremiumSummary.tsx`, `ClaimIncidentStep.tsx` |
| useContext + useReducer | `QuoteContext.tsx` |
| Router, nested routes, useParams, useSearchParams | `App.tsx`, `PolicyDetailPage.tsx`, `PoliciesPage.tsx` |
| Protected route | `RequireRole` in `App.tsx` |
| memo / useCallback | `PolicyRow` in `PolicyBook.tsx`, `PoliciesPage.tsx` |
| useMemo | `ThemeModeProvider.tsx` theme, `QuoteContext.tsx` context value |
| Custom hooks | `hooks.ts` |
| lazy + Suspense | `App.tsx` |
| Error boundary | `ErrorBoundary.tsx`, keyed per route in `App.tsx` |
| useLayoutEffect | `StickyPremiumSummary.tsx` |
| useImperativeHandle | `ClaimIncidentStep.tsx` |
| MUI + theme + dark/light/system | `ThemeModeProvider.tsx`, `AppShell.tsx` |
| Axios instance + interceptors | `http/client.ts`, `http/interceptors.ts` |
| Redux Toolkit | `store/` |
| RHF + Zod | `ClaimIntakePage.tsx`, `UnderwritingDecisionForm.tsx` |

## Notes

The book is 240 policies: twelve hand-written households expanded by a fixed
table of name, status, sum-insured, term and expiry offsets. No randomness, so
every run rates the same book.

At that size the list memoisation is load-bearing, and measurably so. Typing
three characters into the search box re-renders `PoliciesPage` three times. With
`memo` on `PolicyRow` and `useCallback` on its handler, `PolicyRow` renders 240
times on first paint and **0** times across those keystrokes. Drop either one —
`memo`, or the `useCallback` that keeps its props stable — and it is **720**.
They only work as a pair.

Sorting the book, by contrast, costs 0.03 ms. That is not worth a `useMemo`, so
there isn't one; the sort runs on every render. The `useMemo` that does pay for
itself is `createAegisTheme` in `ThemeModeProvider.tsx` at 0.37 ms a call, where
a fresh theme object would also re-render every MUI component beneath it.
`DashboardPage` and `UnderwritingPage` derive their figures on every render for
the same reason: at this size, memoising them buys nothing.

Access tokens expire after 60 seconds and the refresh token rotates, but the
rotation chain is cut off after three uses. So a session survives about four
minutes of clicking and then genuinely ends: the refresh is refused, the
interceptor dispatches `logout()`, and the request fails with "Your session has
ended." If you are on a policy page when that happens, `PolicyDetailPage` throws
and the route error boundary catches it — and its **Retry** works, because the
next request finds no token and signs in again.

The same boundary catches a bad policy id (`/policies/POL-9999`): there Retry
correctly keeps failing, because the policy still does not exist.

Failed requests also surface as a toast carrying a correlation id (`req-0007`),
the same id sent on the request header, so a user can quote it when they report
a problem. The correlation id lives in Redux only — `ApiError` carries a message
and nothing else, so there is one source for it rather than two.

The quote draft lives in React context and is gone when you leave the wizard.
The session and the claims you filed live in Redux and survive navigation. That
contrast is deliberate.
