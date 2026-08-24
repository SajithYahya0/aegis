/**
 * WHY THIS EXISTS:
 *   Pins the one behaviour in `ErrorBoundary` that is easy to get wrong and
 *   impossible to eyeball: that Retry actually remounts the children, and that
 *   `onRetry` runs before that remount rather than after it. Both mistakes
 *   leave a boundary that looks completely correct in manual testing — the
 *   fallback appears, the button is clickable, the error clears — while
 *   silently recovering nothing.
 *
 * CONCEPTS: W3-D4-01, W3-D4-02, W3-D2-07
 *
 * WITHOUT THIS:
 *   The regression is a one-word edit. Change
 *   `<Fragment key={attempt}>{children}</Fragment>` to `{children}` and the
 *   boundary still passes every manual check, because the difference only
 *   shows up when the child would throw *again* on re-render — which is
 *   exactly the case Retry exists for, and exactly what `api.ts`'s promise
 *   cache and `React.lazy`'s module registry both produce. The third test
 *   below models the promise cache directly: the child keeps throwing until
 *   something evicts, so a retry that does not remount, or that evicts too
 *   late, leaves the fallback on screen and fails.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

/**
 * React 19 forwards every boundary-caught error to `reportError`, which jsdom
 * dispatches as a window `error` event and Vitest then counts as an unhandled
 * exception — failing the run even though the boundary handled the error
 * correctly, which is the entire thing under test. Marking the event handled
 * suppresses that without hiding anything the assertions care about; the
 * `console.error` spy does the same for React's own logging.
 */
function swallowReportedError(event: ErrorEvent): void {
  event.preventDefault();
  event.stopImmediatePropagation();
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.addEventListener('error', swallowReportedError, true);
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  window.removeEventListener('error', swallowReportedError, true);
  errorSpy.mockRestore();
});

describe('ErrorBoundary', () => {
  it('renders children untouched when nothing throws', () => {
    render(
      <ErrorBoundary label="Widget">
        <p>all good</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText('all good')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('catches a render-phase throw and shows the fallback with the message', () => {
    function AlwaysThrows(): ReactElement {
      throw new Error('upstream 503');
    }

    render(
      <ErrorBoundary label="Risk exposure">
        <AlwaysThrows />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Risk exposure could not be displayed.')).toBeInTheDocument();
    expect(screen.getByText('upstream 503')).toBeInTheDocument();
  });

  /*
   * Note the shape of the child here, which is not the obvious one. The
   * tempting model is "throws on its first render, succeeds on its second" —
   * and it does not work, for a reason worth knowing: when a concurrent render
   * throws, React discards it and immediately re-renders the whole root
   * synchronously to get a reliable stack. A child that fails exactly once
   * therefore succeeds on that automatic second attempt and never reaches the
   * boundary at all — the test would render "recovered" with no fallback ever
   * shown and no Retry to click. A deterministic failure gated on external
   * state is the only model that survives, which is also the more faithful one:
   * a poisoned cache entry does not heal itself on a re-render either.
   */
  it('remounts children on Retry rather than re-rendering the same instance', () => {
    let poisoned = true;
    let mounts = 0;

    function ReadsCache(): ReactElement {
      mounts += 1;
      if (poisoned) throw new Error('boom');
      return <p>recovered</p>;
    }

    render(
      <ErrorBoundary label="Widget" onRetry={() => { poisoned = false; }}>
        <ReadsCache />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    const mountsBeforeRetry = mounts;

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(screen.getByText('recovered')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    // The child ran again after the retry. Without the key bump the boundary
    // would reconcile against the existing fiber and this would not move.
    expect(mounts).toBeGreaterThan(mountsBeforeRetry);
  });

  it('runs onRetry before the remount, so the eviction has already taken effect', () => {
    /*
     * Stands in for `api.ts`'s module-level promise cache: the child keeps
     * throwing for as long as the poisoned entry is there, and only `onRetry`
     * can clear it. If `onRetry` ran *after* the remount — or not at all — the
     * remounted child would read `cachePoisoned === true` and throw again, so
     * this test fails on ordering, not just on omission.
     */
    let cachePoisoned = true;

    function ReadsCache(): ReactElement {
      if (cachePoisoned) throw new Error('cached rejection replayed');
      return <p>fresh data</p>;
    }

    const onRetry = vi.fn(() => {
      cachePoisoned = false;
    });

    render(
      <ErrorBoundary label="Policy detail" onRetry={onRetry}>
        <ReadsCache />
      </ErrorBoundary>,
    );

    expect(screen.getByText('cached rejection replayed')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByText('fresh data')).toBeInTheDocument();
  });
});
