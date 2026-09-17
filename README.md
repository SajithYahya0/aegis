# AEGIS

An insurance book, split across three deployables that each want a different
rendering strategy and a different release cadence.

| App | What it is | Who owns it | Rendering |
|---|---|---|---|
| `apps/web` | Broker & underwriter console, behind a login | Console team | CSR (Vite SPA) |
| `apps/public` | Marketing site, "get a quote", "check a policy" | Marketing | SSG / ISR / SSR (Next App Router) |
| `apps/claims` | The claim intake form, exposed as a remote | Claims-ops | Built once, loaded at runtime |

The split is not decoration. The console is behind a login and has no SEO to
win, so client rendering is correct. The public site is indexed and must be fast
on a cold phone, so it renders on the server. And the claim intake form changes
whenever the first-notice-of-loss requirements change — far more often than the
console ships — so claims-ops owns it as a Module Federation remote and deploys
it without a console release.

## Running it

```
npm install

npm run dev:claims               # terminal 1 — vite build --watch into apps/claims/dist
npm run preview -w apps/claims   # terminal 2 — serves the remote on :5174
npm run dev:web                  # terminal 3 — the console on :5173
npm run dev:public               # terminal 4 — the public site on :3000
```

Order matters for the console's **New claim** page: it fetches
`http://localhost:5174/assets/remoteEntry.js` at runtime. If the remote is down
the rest of the console still works and that one route shows "The claims-ops
intake form could not be displayed" with a Retry — which is the point of the
boundary.

The console's dashboard reads website enquiries from the public site through a
Vite dev proxy (`/site-api/*` to `http://localhost:3000/api/*`), so if the
public site is not running the enquiries card is simply absent.

```
npm run build       # claims, then web, then public
npm run typecheck   # tsc for web + claims, then next's tsc for public
```

Override the remote and the site at build time with `VITE_CLAIMS_REMOTE` and
`VITE_PUBLIC_SITE`.

## Structure

```
package.json                  npm workspaces, cross-app scripts
tsconfig.json                 typechecks apps/web and apps/claims

apps/web/                     the console — 29 source files, 2,873 lines
  index.html
  vite.config.ts              federation host, /site-api proxy
  src/
    main.tsx                  composition root: mock backend, interceptors, providers
    remotes.d.ts              the federation contract the console codes against
    App.tsx                   route table, lazy chunks, role guard, route error boundary
    shared/
      domain.ts               types, formatters, enum labels
      data.ts                 12 households expanded to a 240-policy book, 10 claims
      rating.ts               cover catalogue + the premium calculation
      ThemeModeProvider.tsx   the MUI theme plus light / dark / system, persisted
      AppShell.tsx            app bar, nav drawer, role switch, error toast
      ErrorBoundary.tsx       retry remounts children under a fresh key
      hooks.ts                useDebounce, useLocalStorage
      http/
        client.ts             axios instance, endpoints, and the public site's enquiries
        interceptors.ts       auth header, 401 refresh + replay, error toast state
        mockSession.ts        latency, token issue, access expiry, refresh rotation
        mockBackend.ts        the resource routes
      store/                  store wiring, auth slice, claims slice
    routes/
      DashboardPage.tsx       metrics, website enquiries, renewals due, claims filed
      PoliciesPage.tsx        search, filters in the URL, sortable 240-row book
      PolicyBook.tsx          the filter bar and one memoised row
      PolicyDetailPage.tsx    policy header + nested tab routes; throws on a failed load
      PolicyTabs.tsx          cover lines, claims on the policy
      QuoteContext.tsx        wizard draft reducer + provider
      QuoteWizardPage.tsx     four-step quote: stepper, validation, review
      QuoteSteps.tsx          the fields for each step
      StickyPremiumSummary.tsx  fixed premium bar, measured before paint
      ClaimIntakeRoute.tsx    loads the claims remote and hands it the book
      UnderwritingPage.tsx    referral queue
      UnderwritingDecisionForm.tsx  decision form, limits come from the server

apps/claims/                  the remote — 3 source files, 308 lines
  index.html                  a page saying where remoteEntry.js is
  vite.config.ts              federation remote: exposes, shared, CORS on preview
  src/
    ClaimIntake.tsx           the exposed component: incident, review, file
    IncidentFields.tsx        the six incident fields, focuses the first invalid one
    claimSchema.ts            Zod rules and the props contract the host codes against

apps/public/                  the site — 12 source files, 691 lines
  next.config.ts, tsconfig.json
  app/
    layout.tsx                shell, nav, metadata
    aegis.module.css          every class the site uses, light and dark
    page.tsx                  marketing (SSG)
    quote/page.tsx            rate card + form (ISR, 1h)
    quote/QuoteForm.tsx       'use client', unwraps the rate card with use()
    status/page.tsx           policy lookup and summary (SSR)
    status/ClaimsHistory.tsx  streamed in below the summary
    status/loading.tsx        skeleton while the summary loads
    status/error.tsx          'use client', reset() plus the error digest
    api/quote-requests/route.ts   GET + POST; the console reads what the site writes
  lib/
    rates.ts                  the hourly rate card and the premium it implies
    book.ts                   the policy admin system and the slow claims system
```

## Rendering strategies, and what breaks if you pick another

| Route | Strategy | Why | If you picked something else |
|---|---|---|---|
| `/` marketing | **SSG** (`dynamic = 'force-static'`) | Nothing on it is per-user or per-request. It is the page search engines index and the page a cold phone lands on, so it should be a file on a CDN. | **SSR** pays a server round trip on every visit for identical bytes, and a cold function puts TTFB in front of the one page whose bounce rate matters most. **CSR** serves an empty shell to crawlers. **ISR** is SSG plus a revalidation machine guarding content that never changes. |
| `/quote` | **ISR** (`revalidate = 3600`) | The premium is priced off a rate card republished at the top of every hour. Every visitor within an hour sees the same card, so build it once an hour and serve it static in between. | **SSG** freezes the rates at build time and quotes yesterday's numbers until the next deploy — the one failure mode that actually costs money. **SSR** re-runs the rating service on every visit to produce output that is provably identical for the rest of the hour. **CSR** flashes an empty premium and moves the filed-rate calculation into the browser, where it does not belong. |
| `/status` | **SSR** (`dynamic = 'force-dynamic'`) | The answer depends on a reference and a surname in the query string and on live policy state. It must never be cached and must never be served to the wrong person. | **SSG** cannot be built: the set of policies is not enumerable at build time and the data is private. **ISR** is worse than SSG — it caches one customer's policy under a URL and hands it to the next visitor. **CSR** works, but ships the lookup to the browser and shows a spinner where a server render shows the summary in the first flush. |
| `/api/quote-requests` | **Route handler**, `force-dynamic` | A write endpoint plus a read the console polls. Caching either direction is a bug. | A cached GET shows brokers a stale lead list. |
| console (`apps/web`) | **CSR** | Behind a login, no SEO, and the user spends an hour filtering a 240-row book. Server rendering buys one faster first paint and pays for it on every interaction. | SSR needs the session on the server and makes no screen after the first any faster. |

Streaming earns its place on `/status` because the two reads have genuinely
different latencies: the policy summary comes from the admin system in ~220 ms,
the claims history from the settlement system in ~1.6 s. Without `<Suspense>`
the whole page waits 1.6 s for the slow half. With it the summary is in the
first flush and the claims table arrives later in the same response — visible in
raw HTML, no JavaScript involved:

```
curl -s "localhost:3000/status?ref=POL-1001&surname=nair"
   Checking the policy...          loading.tsx, first flush
   Priya Nair - Motor              the summary
   Fetching claims from ...        the Suspense fallback
   CLM-5001 ... CLM-5002           the streamed chunk
```

`loading.tsx` covers the first 220 ms. `error.tsx` catches an unknown reference
or an unreachable admin system, and its `reset()` re-runs the server render. It
shows its own copy rather than `error.message`, because Next redacts server
error messages in production; what it does surface is the error digest — the
same "quote this reference to support" idea as the console's correlation id.

## Module Federation

The curriculum reference is webpack's Module Federation. Both apps here are
Vite, so this uses `@originjs/vite-plugin-federation`, the Vite implementation
of the same specification. The concepts map one to one:

| webpack concept | Here | File |
|---|---|---|
| `ModuleFederationPlugin({ name })` | `federation({ name: 'claims' })` and `{ name: 'console' }` | both `vite.config.ts` |
| `filename: 'remoteEntry.js'` | same; emitted to `dist/assets/remoteEntry.js` | `apps/claims/vite.config.ts` |
| `exposes` | `{ './ClaimIntake': './src/ClaimIntake.tsx' }` | `apps/claims/vite.config.ts` |
| `remotes` | `{ claims: 'http://localhost:5174/assets/remoteEntry.js' }` | `apps/web/vite.config.ts` |
| `shared` singletons | `react`, `react-dom`, `@emotion/react`, `@emotion/styled`, `@mui/material` | both configs |
| Consuming a remote module | `lazy(() => import('claims/ClaimIntake'))` | `ClaimIntakeRoute.tsx` |

`react` and `react-dom` **must** be shared, or the remote brings its own copy,
two Reacts fight over one tree, and hooks throw. `@mui/material` and the two
emotion packages are shared for a subtler reason: the remote's form renders
inside the console's `ThemeProvider`, and theme context only crosses the
boundary if both sides resolve the same MUI module instance. Unshare them and
the form still mounts — it just renders in MUI's default theme, in the middle of
a dark-mode console.

The contract is: the host passes the policies the broker may claim against, an
optional preselected policy, and an `onFile` callback. The remote owns the
fields, the Zod rules and the two-step flow; it has no idea the console uses
axios, Redux or a mock backend.

The host states that contract for itself, in `apps/web/src/remotes.d.ts`. The
alternative — mapping `claims/*` to the remote's source in `tsconfig.json` — is
tempting because it can never drift, but it is the wrong shape for a micro
frontend. It typechecks the console against source the console does not build
and will not ship: at runtime the console loads whatever version claims-ops
deployed, so a green typecheck would be false confidence. It also only works
while both apps share a repository, which is precisely the arrangement the
remote exists to escape. A declaration file says what the host depends on,
lives with the host, survives the repo split, and turns a contract change into
a visible edit at the boundary rather than an invisible consequence of someone
else's refactor. Its one weakness — it can drift from the deployed remote — is
not a flaw in the technique; it is the real risk, written down.

The console wraps the remote in its own `ErrorBoundary` and `Suspense`, so a
claims-ops deploy that breaks the remote degrades to one broken route with a
Retry, not a white console.

## Where each idea lives

| Concept | File |
|---|---|
| useState, lists, keys, conditionals | `web/routes/PoliciesPage.tsx` |
| useEffect + cleanup (abort) | `web/routes/PoliciesPage.tsx` search effect |
| useRef (DOM) | `web/routes/StickyPremiumSummary.tsx`, `claims/src/IncidentFields.tsx` |
| useContext + useReducer | `web/routes/QuoteContext.tsx` |
| Router, nested routes, useParams, useSearchParams | `web/App.tsx`, `PolicyDetailPage.tsx`, `PoliciesPage.tsx` |
| Protected route | `RequireRole` in `web/App.tsx` |
| memo / useCallback | `PolicyRow` in `web/routes/PolicyBook.tsx` |
| useMemo | `web/shared/ThemeModeProvider.tsx`, `web/routes/QuoteContext.tsx` |
| Custom hooks | `web/shared/hooks.ts` |
| lazy + Suspense | `web/App.tsx`, `web/routes/ClaimIntakeRoute.tsx` |
| Error boundary | `web/shared/ErrorBoundary.tsx`, keyed per route in `App.tsx` |
| useLayoutEffect | `web/routes/StickyPremiumSummary.tsx` |
| useImperativeHandle | `claims/src/IncidentFields.tsx` |
| MUI + theme + dark/light/system | `web/shared/ThemeModeProvider.tsx`, `AppShell.tsx` |
| Axios instance + interceptors | `web/shared/http/client.ts`, `interceptors.ts` |
| Redux Toolkit | `web/shared/store/` |
| RHF + Zod | `claims/src/ClaimIntake.tsx`, `web/routes/UnderwritingDecisionForm.tsx` |
| CSR vs SSR vs SSG vs ISR | the table above; `public/app/{page,quote/page,status/page}.tsx` |
| Server vs Client Components | `public/app/quote/page.tsx` (server) wraps `QuoteForm.tsx` (`'use client'`) |
| Data fetching in Server Components | `public/app/status/page.tsx` awaits `findPolicy` |
| Streaming with Suspense | `public/app/status/page.tsx` renders `ClaimsHistory.tsx` |
| loading.js / error.js | `public/app/status/loading.tsx`, `error.tsx` |
| Route handlers | `public/app/api/quote-requests/route.ts`, read by `web/shared/http/client.ts` |
| use() hook | `public/app/quote/QuoteForm.tsx` unwraps the rate card promise |
| CSS Modules | `public/app/aegis.module.css` |
| Module Federation | `apps/claims` exposes, `apps/web` consumes via `src/remotes.d.ts` |
| TypeScript | strict everywhere, no `any`, no suppressions |

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

Access tokens expire after 60 seconds and the refresh token rotates, but the
rotation chain is cut off after three uses. So a session survives about four
minutes of clicking and then genuinely ends: the refresh is refused, the
interceptor dispatches `logout()`, and the request fails with "Your session has
ended." If you are on a policy page when that happens, `PolicyDetailPage` throws
and the route error boundary catches it — and its **Retry** works, because the
next request finds no token and signs in again. The same boundary catches a bad
policy id (`/policies/POL-9999`): there Retry correctly keeps failing.

Failed requests also surface as a toast carrying a correlation id (`req-0007`),
the same id sent on the request header.

The quote draft lives in React context and is gone when you leave the wizard.
The session and the claims you filed live in Redux and survive navigation. That
contrast is deliberate.

The public site quotes off the published rate card; the console quotes off its
own filed rates in `rating.ts`. They agree at the top of the hour and drift
within it, which is correct — a broker binds at the filed rate, the website
shows what was published.

`apps/public` keeps its enquiries in a module-level array. That is one process's
memory, which is right for a demo and wrong for production, where it would be a
queue.
