/**
 * WHY THIS EXISTS:
 *   One place that owns every code-split boundary in the app, and the only
 *   place that knows how to do the two things `React.lazy` alone cannot: start
 *   a chunk download *before* React asks for it, and throw away a chunk whose
 *   download failed so a Retry can genuinely try again.
 *
 *   `React.lazy` gives you the split and no handle on the loader — once you
 *   pass the import function into `lazy()` you can never call it yourself, so
 *   there is nothing to trigger on hover and nothing to reset after a failure.
 *   Wrapping each loader here keeps a reference to it and hands back three
 *   parts: the `Component` for the route table, a `preload()` for the nav, and
 *   a `reset()` for the error boundary.
 *
 * CONCEPTS: W3-D3-01, W3-D3-02, W3-D3-05, W3-D4-02, W3-D5-05
 *
 * WITHOUT THIS:
 *   Four separate problems, one per thing this file does.
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
 *   the entry chunk. `AppShell` renders on every route and reads `AS_OF` from
 *   it for the valuation-date line in the app bar, and a module reachable from
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
 *   `↓ … (preload)`; click it and the console prints `⤳ … already requested
 *   (render)` instead of a second download. That pair of lines is the proof.
 *
 *   No `reset()` — and this is the one that shipped broken through Phase 5,
 *   caught by measurement rather than by reading. A chunk whose `import()`
 *   rejects (stale deploy, dropped connection) surfaces as a render-phase throw
 *   and lands in `App.tsx`'s per-route `<ErrorBoundary>`, which offers a Retry.
 *   That Retry could not work, and an earlier version of `ErrorBoundary`'s
 *   header wrongly claimed it could. `React.lazy` stores its outcome on a
 *   payload object hanging off the lazy component itself — module scope, not
 *   fiber scope — and once that payload is `Rejected`, every subsequent read
 *   re-throws the same error. The boundary's `key` bump discards the *fiber*
 *   and reads the same payload straight back. Measured, not reasoned about: a
 *   probe rendering a rejecting `lazy()` inside this boundary recorded one
 *   import attempt before Retry and one after — the loader was never called a
 *   second time, and the fallback never cleared.
 *
 *   Two things have to be thrown away to recover, which is why `reset()` does
 *   both. Clearing `pending` alone is not enough: the rejected payload still
 *   sits on the old lazy component. Re-creating the lazy component alone is not
 *   enough either: `start()` would hand it the same memoised rejected promise.
 *   And a third piece is what makes the first two reachable — `Component` is a
 *   plain wrapper that reads `current` *at render time* rather than being the
 *   lazy component itself. Without that indirection the route table's element
 *   captures whichever lazy object existed when `App` rendered, and a boundary
 *   remount re-renders that captured element; `reset()` would swap a variable
 *   nothing reads. The wrapper is one extra function component and it is the
 *   difference between a working Retry and a decorative one.
 *
 *   No shared registry: the nav in `AppLayout` would need its own import
 *   functions to preload, duplicating the paths that `App.tsx` already lists.
 *   The two copies then drift — a route gets renamed, the route table follows,
 *   and the nav quietly preloads a module nobody renders any more. Both read
 *   from `LAZY_ROUTES` here instead. `ClaimIntakePage`'s component-level split
 *   (W3-D3-02) calls `splitChunk` directly for the same reason: it is the same
 *   rejected-payload problem, so it gets the same `reset()` rather than a
 *   second, subtly different copy of this logic.
 */

import { lazy, type ComponentType, type LazyExoticComponent, type ReactElement } from 'react';

type ModuleLoader<P> = () => Promise<{ default: ComponentType<P> }>;

export interface SplitChunk<P> {
  /** Pass to a `<Route element>` or render directly; must sit under a `<Suspense>`. */
  Component: ComponentType<P>;
  /** Idempotent. Safe to call on every hover and focus event. */
  preload: () => void;
  /**
   * Discards a failed import so the next render genuinely re-requests it. Wire
   * this to the enclosing `<ErrorBoundary onRetry>` — see this file's header
   * for why a boundary's `key` bump cannot do it alone.
   */
  reset: () => void;
}

/**
 * A route chunk carries no props; the route table renders `<Component />` bare.
 * `object` rather than `Record<string, never>` because that is what TypeScript
 * infers for a `default` export declared as `(): ReactElement` — spelling the
 * empty-props case more strictly here makes every route export fail to assign.
 */
export type LazyRoute = SplitChunk<object>;

/**
 * Wraps one dynamic import so the download can be started from two places —
 * React's render path and an intent handler — while only ever happening once,
 * and so a failed download can be thrown away rather than remembered forever.
 */
export function splitChunk<P extends object>(name: string, load: ModuleLoader<P>): SplitChunk<P> {
  let pending: Promise<{ default: ComponentType<P> }> | null = null;
  let current: LazyExoticComponent<ComponentType<P>> = lazy(() => start('render'));

  function start(reason: 'preload' | 'render'): Promise<{ default: ComponentType<P> }> {
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

  function reset(): void {
    console.log(`[chunk] ⟲ ${name} reset — discarding the failed import`);
    // Both, in this order, and neither is sufficient alone. See the header.
    pending = null;
    current = lazy(() => start('render'));
  }

  /*
   * Deliberately NOT `Component: current`. This wrapper re-reads `current` on
   * every render, which is what lets `reset()` swap the lazy component behind
   * an element the route table created long ago. Assigning the lazy component
   * directly freezes it into that element forever.
   */
  function Component(props: P): ReactElement {
    const Current = current;
    return <Current {...props} />;
  }
  Component.displayName = `Split(${name})`;

  return {
    Component,
    preload: () => {
      void start('preload');
    },
    reset,
  };
}

/* -------------------------------------------------------------------------- */
/* Top-level routes                                                           */
/* -------------------------------------------------------------------------- */

export const DashboardRoute = splitChunk('DashboardPage', () => import('../../routes/DashboardPage'));
export const PoliciesRoute = splitChunk('PoliciesPage', () => import('../../routes/PoliciesPage'));
export const PolicyDetailRoute = splitChunk(
  'PolicyDetailPage',
  () => import('../../routes/PolicyDetailPage'),
);
export const QuoteWizardRoute = splitChunk(
  'QuoteWizardPage',
  () => import('../../routes/QuoteWizardPage'),
);
export const ClaimIntakeRoute = splitChunk(
  'ClaimIntakePage',
  () => import('../../routes/ClaimIntakePage'),
);
export const UnderwritingRoute = splitChunk(
  'UnderwritingPage',
  () => import('../../routes/UnderwritingPage'),
);
export const NotFoundRoute = splitChunk('NotFoundPage', () => import('../../routes/NotFoundPage'));

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
export const PolicyCoverageRoute = splitChunk(
  'PolicyCoverageTab',
  () => import('../../routes/policyDetail/PolicyCoverageTab'),
);
export const PolicyClaimsRoute = splitChunk(
  'PolicyClaimsTab',
  () => import('../../routes/policyDetail/PolicyClaimsTab'),
);
export const PolicyDocumentsRoute = splitChunk(
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
