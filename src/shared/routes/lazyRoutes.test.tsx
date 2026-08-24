/**
 * WHY THIS EXISTS:
 *   Pins the one claim in the code-splitting story that was asserted for two
 *   phases and was false: that the error boundary's Retry recovers a route
 *   whose chunk failed to download.
 *
 *   It did not. `React.lazy` records a rejected import on a payload object
 *   hanging off the lazy component — module scope, not fiber scope — so the
 *   boundary's `key` bump discarded the fiber and read the same rejection
 *   straight back. A probe recorded one import attempt before Retry and one
 *   after: the loader was never called again, and the fallback never cleared.
 *   `splitChunk`'s `reset()` is the fix, and this file is what stops it
 *   regressing.
 *
 * CONCEPTS: W3-D3-01, W3-D3-02, W3-D4-02, W3-D2-07
 *
 * WITHOUT THIS:
 *   The regression is silent and it is a one-word edit in either of two files.
 *   Drop `onRetry` from `App.tsx`'s `BoundedRoute`, or make `reset()` clear
 *   `pending` without re-creating the lazy component, and every visible
 *   behaviour is unchanged — the fallback appears, the button is clickable, the
 *   console logs a retry — while nothing recovers. That is exactly the state
 *   this repo shipped in, and reading the code did not catch it; only counting
 *   the loader's calls did. So this test counts them.
 *
 *   The third assertion is the one that matters most and is the easiest to omit:
 *   `reset()` must re-create the lazy component, not just null the memoised
 *   promise. Clearing `pending` alone leaves the rejected payload in place, so
 *   the loader is never re-entered — the counter stays put and the test fails on
 *   `loaderCalls`, not on the visible output.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { Suspense, type ComponentType, type ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { splitChunk } from './lazyRoutes';

/**
 * What each probe loader resolves to. Annotated explicitly at every call site
 * below because a `reject ? : resolve` ternary infers a union — TypeScript
 * types the rejecting branch as `Promise<{ default: ComponentType<never> }>`,
 * which does not unify with the resolving branch and makes `splitChunk`'s
 * parameter unassignable. The annotation is about the ternary, not the API.
 */
type ChunkModule = { default: ComponentType<object> };

/**
 * React 19 forwards every boundary-caught error to `reportError`, which jsdom
 * dispatches as a window `error` event and Vitest counts as an unhandled
 * exception — failing the run over the very thing under test. Same treatment as
 * `ErrorBoundary.test.tsx`; see that file's note.
 */
function swallowReportedError(event: ErrorEvent): void {
  event.preventDefault();
  event.stopImmediatePropagation();
}

let errorSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  window.addEventListener('error', swallowReportedError, true);
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  // splitChunk logs every request, retry and cache hit by design; silenced here
  // so a failing run shows assertions rather than chunk chatter.
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  window.removeEventListener('error', swallowReportedError, true);
  errorSpy.mockRestore();
  logSpy.mockRestore();
});

describe('splitChunk', () => {
  it('recovers a failed chunk when the boundary Retry resets it', async () => {
    let networkDown = true;
    let loaderCalls = 0;

    const chunk = splitChunk<object>('ProbeChunk', (): Promise<ChunkModule> => {
      loaderCalls += 1;
      return networkDown
        ? Promise.reject(new Error('chunk load failed'))
        : Promise.resolve({ default: (): ReactElement => <p>chunk arrived</p> });
    });

    render(
      <ErrorBoundary
        label="Probe"
        onRetry={() => {
          networkDown = false;
          chunk.reset();
        }}
      >
        <Suspense fallback={<p>loading</p>}>
          <chunk.Component />
        </Suspense>
      </ErrorBoundary>,
    );

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(loaderCalls).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    /*
     * The load is asynchronous, so the recovered content arrives through the
     * Suspense fallback rather than synchronously with the click. Before the
     * fix this `findBy` timed out with the fallback still on screen.
     */
    expect(await screen.findByText('chunk arrived')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    // The loader really ran a second time. This is the assertion that fails if
    // `reset()` clears `pending` but leaves the rejected lazy payload in place.
    expect(loaderCalls).toBe(2);
  });

  it('does not recover without reset, which is why reset exists', async () => {
    let networkDown = true;
    let loaderCalls = 0;

    const chunk = splitChunk<object>('UnresettableProbe', (): Promise<ChunkModule> => {
      loaderCalls += 1;
      return networkDown
        ? Promise.reject(new Error('chunk load failed'))
        : Promise.resolve({ default: (): ReactElement => <p>chunk arrived</p> });
    });

    /*
     * The shipped-and-broken arrangement, kept as an executable record of it:
     * a boundary whose retry heals the world but never tells the chunk. If a
     * future React makes remounting re-run a rejected lazy loader on its own,
     * this test fails — and that failure is the signal that `reset()` has
     * become unnecessary, not that something broke.
     */
    render(
      <ErrorBoundary
        label="Probe"
        onRetry={() => {
          networkDown = false;
        }}
      >
        <Suspense fallback={<p>loading</p>}>
          <chunk.Component />
        </Suspense>
      </ErrorBoundary>,
    );

    expect(await screen.findByRole('alert')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await Promise.resolve();

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('chunk arrived')).not.toBeInTheDocument();
    expect(loaderCalls).toBe(1);
  });

  it('memoises the loader across preload and render', () => {
    let loaderCalls = 0;
    const chunk = splitChunk<object>('PreloadProbe', (): Promise<ChunkModule> => {
      loaderCalls += 1;
      return Promise.resolve({ default: (): ReactElement => <p>ok</p> });
    });

    chunk.preload();
    chunk.preload();
    expect(loaderCalls).toBe(1);

    render(
      <Suspense fallback={<p>loading</p>}>
        <chunk.Component />
      </Suspense>,
    );

    // The render path reuses the promise the hover already started. Without the
    // memo this would be 3 — and no observable behaviour would differ, which is
    // why it is asserted rather than eyeballed.
    expect(loaderCalls).toBe(1);
  });
});
