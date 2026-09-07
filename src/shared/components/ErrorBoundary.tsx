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
