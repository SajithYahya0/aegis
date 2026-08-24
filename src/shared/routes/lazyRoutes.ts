/**
 * WHY THIS EXISTS:
 *   One place that owns every code-split boundary in the route table, and the
 *   only place that knows how to start a chunk download *before* React asks
 *   for it. `React.lazy` alone gives you the split but no handle on the
 *   loader — once you pass the import function into `lazy()` you can never
 *   call it yourself, so there is nothing to trigger on hover. Wrapping each
 *   loader here keeps a reference to it and hands back both halves: the
 *   `Component` for the route table and a `preload()` for the nav.
 *
 * CONCEPTS: W3-D3-01, W3-D3-05, W3-D5-05
 *
 * WITHOUT THIS:
 *   Three separate problems, one per thing this file does.
 *
 *   No `React.lazy` at all (which is what shipped through Phase 3): every
 *   route component is a static import in `App.tsx`, so the initial bundle
 *   contains the quote wizard's reducer, the claim intake wizard, the
 *   underwriting page and the whole rating engine before the user has clicked
 *   anything. Someone who opens the dashboard and leaves has downloaded and
 *   parsed all of it. Splitting per route means the dashboard visitor pays for
 *   the dashboard. Confirmed against `vite build`, not assumed: `rating.ts`
 *   now lands in `PoliciesPage`'s chunk rather than the entry chunk, which is
 *   the single biggest thing this file moves.
 *
 *   What did NOT split, and why it is worth knowing: `src/shared/data` stays in
 *   the entry chunk. `AppLayout` renders on every route and reads `AS_OF` from
 *   it for the valuation-date line in the header, and a module reachable from
 *   a statically-imported component cannot be in a lazy chunk — one static
 *   import anywhere pins the whole module graph below it. `React.lazy` splits
 *   the graph where the imports are, not where the intent is, so a single
 *   innocuous import in shared chrome silently un-splits a dependency. This is
 *   the failure mode to check for when a split "does not seem to help": the
 *   route chunk shrinks, the entry chunk does not, and the reason is always an
 *   edge like this one. It is left as-is here because the seed data is a
 *   generator (a few kB of code, not 140 policies of JSON) and every route
 *   needs it anyway — but it was measured before being accepted, not assumed
 *   away.
 *
 *   No memoised loader: the naive preload is `onMouseEnter={() => import(...)}`
 *   written inline at the nav. Every mouse pass over the link calls `import()`
 *   again. The browser's module cache does deduplicate the *network* fetch, so
 *   this is not a bandwidth bug — it is worse than it looks in a different way:
 *   there is no way to tell from the outside whether a preload did anything,
 *   because every call resolves identically whether it started a download or
 *   found one already finished. `start()` below collapses the calls to one and
 *   logs *which* kind each one was, which is what makes the preload observable
 *   rather than merely plausible. Hover a nav item and the console prints one
 *   `↓ … (preload)`; click it and the console prints `⤳ … already resolved
 *   (render)` instead of a second download. That pair of lines is the proof.
 *
 *   No shared registry: the nav in `AppLayout` would need its own import
 *   functions to preload, duplicating the paths that `App.tsx` already lists.
 *   The two copies then drift — a route gets renamed, the route table follows,
 *   and the nav quietly preloads a module nobody renders any more. Both read
 *   from `LAZY_ROUTES` here instead.
 */

import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

type ModuleLoader = () => Promise<{ default: ComponentType }>;

export interface LazyRoute {
  /** Pass to a `<Route element>`; must sit under a `<Suspense>`. */
  Component: LazyExoticComponent<ComponentType>;
  /** Idempotent. Safe to call on every hover and focus event. */
  preload: () => void;
}

/**
 * Wraps one dynamic import so the download can be started from two places —
 * React's render path and an intent handler — while only ever happening once.
 */
function lazyRoute(name: string, load: ModuleLoader): LazyRoute {
  let pending: Promise<{ default: ComponentType }> | null = null;

  function start(reason: 'preload' | 'render'): Promise<{ default: ComponentType }> {
    if (pending) {
      console.log(`[chunk] ⤳ ${name} already requested (${reason})`);
      return pending;
    }
    console.log(`[chunk] ↓ ${name} (${reason})`);
    pending = load();
    /*
     * A rejected import() with no handler attached until React renders the
     * lazy component is an unhandled rejection in the console. Attaching a
     * no-op catch here marks it handled without swallowing it: `pending` still
     * holds the rejected promise, so `React.lazy` re-reads that same rejection
     * and throws it to the nearest ErrorBoundary exactly as it would have.
     */
    pending.catch(() => undefined);
    return pending;
  }

  return {
    Component: lazy(() => start('render')),
    preload: () => {
      void start('preload');
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Top-level routes                                                           */
/* -------------------------------------------------------------------------- */

export const DashboardRoute = lazyRoute('DashboardPage', () => import('../../routes/DashboardPage'));
export const PoliciesRoute = lazyRoute('PoliciesPage', () => import('../../routes/PoliciesPage'));
export const PolicyDetailRoute = lazyRoute(
  'PolicyDetailPage',
  () => import('../../routes/PolicyDetailPage'),
);
export const QuoteWizardRoute = lazyRoute(
  'QuoteWizardPage',
  () => import('../../routes/QuoteWizardPage'),
);
export const ClaimIntakeRoute = lazyRoute(
  'ClaimIntakePage',
  () => import('../../routes/ClaimIntakePage'),
);
export const UnderwritingRoute = lazyRoute(
  'UnderwritingPage',
  () => import('../../routes/UnderwritingPage'),
);
export const NotFoundRoute = lazyRoute('NotFoundPage', () => import('../../routes/NotFoundPage'));

/* -------------------------------------------------------------------------- */
/* Nested tab routes under /policies/:id                                      */
/* -------------------------------------------------------------------------- */

/*
 * The tabs are split separately from their parent on purpose. They are
 * siblings behind three `<NavLink>`s, and a visitor who only ever reads
 * coverage has no reason to download the claims table's fetch/modal/portal
 * machinery. Splitting the parent alone would bundle all three into the parent
 * chunk and the tab nav would be free — but so would be paying for it.
 */
export const PolicyCoverageRoute = lazyRoute(
  'PolicyCoverageTab',
  () => import('../../routes/policyDetail/PolicyCoverageTab'),
);
export const PolicyClaimsRoute = lazyRoute(
  'PolicyClaimsTab',
  () => import('../../routes/policyDetail/PolicyClaimsTab'),
);
export const PolicyDocumentsRoute = lazyRoute(
  'PolicyDocumentsTab',
  () => import('../../routes/policyDetail/PolicyDocumentsTab'),
);

/* -------------------------------------------------------------------------- */
/* Path → chunk, for intent-based preloading                                  */
/* -------------------------------------------------------------------------- */

/**
 * What the sidebar hovers resolve against. Keyed by the same `to` values
 * `AppLayout`'s NAV_ITEMS uses, so a nav entry with no matching chunk simply
 * does not preload rather than preloading the wrong one.
 */
export const PRELOAD_BY_PATH: Readonly<Record<string, () => void>> = {
  '/': DashboardRoute.preload,
  '/policies': PoliciesRoute.preload,
  '/quote': QuoteWizardRoute.preload,
  '/claims/new': ClaimIntakeRoute.preload,
  '/underwriting': UnderwritingRoute.preload,
};

/** Called from a nav link's `onMouseEnter` / `onFocus`. */
export function preloadPath(path: string): void {
  PRELOAD_BY_PATH[path]?.();
}
