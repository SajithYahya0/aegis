/**
 * WHY THIS EXISTS:
 *   Proves `useDebounce` actually waits `delayMs` of silence before adopting
 *   a new value, and that a value change before the timer fires restarts
 *   the wait rather than queuing two updates.
 *
 * CONCEPTS: W3-D2-06
 *
 * WITHOUT THIS:
 *   A cleanup bug — the old timer not being cleared before a new one is set
 *   — would still make the hook "work" for a single slow typist and only
 *   show up as a flurry of extra `setSearchParams` calls under fast typing,
 *   which is exactly the case fake timers can force deterministically and a
 *   human clicking through the UI cannot reliably reproduce.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebounce } from './useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('a', 300));
    expect(result.current).toBe('a');
  });

  it('does not adopt a new value before the delay elapses', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'ab' });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toBe('a');
  });

  it('adopts the latest value once the delay elapses with no further changes', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'ab' });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe('ab');
  });

  it('restarts the wait when the value changes again before the delay elapses', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'ab' });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender({ value: 'abc' });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Only 200ms have elapsed since the second change — 'ab' never lands.
    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toBe('abc');
  });
});
