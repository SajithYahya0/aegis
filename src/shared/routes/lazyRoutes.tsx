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
