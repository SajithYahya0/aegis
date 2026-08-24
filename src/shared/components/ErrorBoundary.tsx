/**
 * WHY THIS EXISTS:
 *   The only thing in React that can stop a render-phase throw from taking the
 *   whole tree down, and it has to be a class: `getDerivedStateFromError` and
 *   `componentDidCatch` have no hook equivalent in React 19. There is no
 *   `useErrorBoundary`. This is the one component in the app that cannot be a
 *   function.
 *
 *   Retry works by bumping a `key` on the wrapper around `children` — because
 *   the module registry and the promise cache both memoise failures, so
 *   clearing error state alone does not recover.
 *
 * CONCEPTS: W3-D4-01, W3-D4-02, W3-D5-04
 *
 * WITHOUT THIS:
 *   A component that throws during render unmounts everything above it up to
 *   the root. With no boundary anywhere, React 19 unmounts the entire tree and
 *   the user gets a blank white page with a console stack — not a broken
 *   widget, the whole console gone. `api.ts`'s `fetchRiskFeed` rejects on every
 *   call by design; without a boundary, one dead third-party feed on
 *   /policies/:id would take the policy, the customer, the coverage table and
 *   the sidebar with it.
 *
 *   Recovery takes two mechanisms, and this header previously claimed one of
 *   them did more than it does. The correction is recorded rather than quietly
 *   applied, because the wrong version was believable enough to survive two
 *   phases of review and ship a Retry button that could not work.
 *
 *   The obvious retry — `this.setState({ error: null })` — looks right and does
 *   nothing, because two independent caches sit between the button and a fresh
 *   attempt, and clearing error state defeats neither:
 *
 *     1. `getPolicyResource(id)` returns a *cached promise*. If that promise
 *        rejected, the Map still holds the rejected promise. Re-rendering the
 *        same child calls `getPolicyResource(id)` again, gets the same settled
 *        rejection back, and `use()` throws it again synchronously — before the
 *        browser paints. The fallback never even flickers away.
 *
 *     2. `React.lazy` does the same thing one level up. A chunk whose import()
 *        rejected (offline, bad deploy) is remembered as failed on a payload
 *        object hanging off the lazy component itself, and every subsequent
 *        read re-throws the stored error without re-requesting anything.
 *
 *   WHAT THE `key` BUMP ACTUALLY DOES — and what it does not. It discards the
 *   *fiber*: same element type, new key, so React drops the old instance and
 *   its in-progress state rather than reconciling with it. That is necessary,
 *   because a child that keeps its fiber keeps whatever local state led it into
 *   the failure.
 *
 *   It clears NEITHER cache above. Both live at module scope, and module scope
 *   is not part of any fiber — nothing React does to the tree can reach them.
 *   An earlier version of this comment asserted that "remounting is what clears
 *   both", which is false, and measurably so: a probe rendering a rejecting
 *   `lazy()` inside this boundary recorded one import attempt before Retry and
 *   one after. The loader was never called a second time and the fallback never
 *   cleared. `src/shared/routes/lazyRoutes.test.tsx` is that probe, kept.
 *
 *   `onRetry` is therefore not a convenience — it is the half that does the
 *   recovering, and every caller owes it. `PolicyDetailPage` and
 *   `RiskExposurePanel` pass `clearPolicyResource(id)` to evict (1);
 *   `App.tsx`'s `BoundedRoute` and `ClaimIntakePage` pass a `SplitChunk`'s
 *   `reset()` to discard (2). A boundary wrapped around something cached, with
 *   no `onRetry`, has a Retry button that clears the fallback for one frame and
 *   re-throws — which is precisely what shipped around the lazy routes.
 *
 *   Ordering follows from that: `handleRetry` calls `onRetry` *before*
 *   `setState`, because the remount re-renders the child immediately and the
 *   cache has to already be clear when it does.
 */

import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react';
import styles from './ErrorBoundary.module.css';

export interface ErrorBoundaryFallbackArgs {
  error: Error;
  /** Runs `onRetry`, then remounts `children` under a fresh key. */
  retry: () => void;
  label: string;
}

export interface ErrorBoundaryProps {
  /** Names the failing region in the fallback and in the console log. */
  label: string;
  children: ReactNode;
  /**
   * Cache eviction that must happen *before* the remount. See this file's
   * header: without it the remounted child re-reads the same rejected promise.
   */
  onRetry?: () => void;
  renderFallback?: (args: ErrorBoundaryFallbackArgs) => ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  /** Increments on every retry. Used as the `key` on the children wrapper. */
  attempt: number;
}

/** Anything can be thrown in JS; the fallback needs a `.message` regardless. */
function toError(thrown: unknown): Error {
  return thrown instanceof Error ? thrown : new Error(String(thrown));
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null, attempt: 0 };

  /**
   * Render phase. Must be static and pure — React may call it while the tree
   * is in an inconsistent state, so it derives state and does nothing else.
   * Side effects belong in `componentDidCatch` below.
   */
  static getDerivedStateFromError(thrown: unknown): Partial<ErrorBoundaryState> {
    return { error: toError(thrown) };
  }

  /**
   * Commit phase. This is where logging goes, and it is the only place that
   * gets `errorInfo.componentStack` — the list of components between the
   * boundary and the throw. Without it the console shows the throw site but
   * not which boundary swallowed it, which on a page with two scoped
   * boundaries is the first question worth answering.
   */
  override componentDidCatch(thrown: unknown, errorInfo: ErrorInfo): void {
    console.error(
      `[boundary] ✕ ${this.props.label} caught:`,
      toError(thrown).message,
      errorInfo.componentStack,
    );
  }

  private handleRetry = (): void => {
    console.log(`[boundary] ↻ ${this.props.label} retry — evicting caches, then remounting`);
    // Order matters: evict first. The remount below re-runs the child's render
    // immediately, and if the rejected promise is still in the Map at that
    // moment the child throws again before this handler has returned.
    this.props.onRetry?.();
    this.setState((prev) => ({ error: null, attempt: prev.attempt + 1 }));
  };

  override render(): ReactNode {
    const { error, attempt } = this.state;
    const { children, label, renderFallback } = this.props;

    if (error) {
      const args: ErrorBoundaryFallbackArgs = { error, retry: this.handleRetry, label };
      if (renderFallback) return renderFallback(args);

      return (
        <div className={styles.fallback} role="alert">
          <p className={styles.title}>{label} could not be displayed.</p>
          <p className={styles.message}>{error.message}</p>
          <div className={styles.actions}>
            <button type="button" className={styles.retry} onClick={this.handleRetry}>
              Retry
            </button>
            {attempt > 0 ? (
              <span className={styles.meta}>
                {attempt} {attempt === 1 ? 'attempt' : 'attempts'} so far
              </span>
            ) : null}
          </div>
        </div>
      );
    }

    /*
     * The keyed wrapper. `attempt` is part of the key, so a retry gives React
     * an element with the same type and a different key — which it treats as a
     * different component instance and remounts, discarding the fiber that
     * remembered the failure. Rendering `{children}` bare here would reconcile
     * against the old fiber instead and the retry would be a no-op.
     */
    return <Fragment key={attempt}>{children}</Fragment>;
  }
}
