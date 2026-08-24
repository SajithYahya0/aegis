/**
 * WHY THIS EXISTS:
 *   Proves the three things the header promises: it reads an existing value
 *   on mount, it survives corrupted JSON instead of throwing, and it writes
 *   updates back so a later mount reading the same key sees them.
 *
 * CONCEPTS: W3-D2-06
 *
 * WITHOUT THIS:
 *   The JSON `try/catch` and the lazy initialiser both look right on a code
 *   read and only actually break against real `localStorage` — the
 *   corrupted-value case in particular has no reliable way to trigger by
 *   clicking through the UI.
 */

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useLocalStorage } from './useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('falls back to the initial value when nothing is stored', () => {
    const { result } = renderHook(() => useLocalStorage('aegis:test', 'fallback'));
    expect(result.current[0]).toBe('fallback');
  });

  it('reads a previously stored value on mount', () => {
    localStorage.setItem('aegis:test', JSON.stringify(['POL-00001']));
    const { result } = renderHook(() => useLocalStorage<string[]>('aegis:test', []));
    expect(result.current[0]).toEqual(['POL-00001']);
  });

  it('falls back to the initial value when the stored JSON is corrupted', () => {
    localStorage.setItem('aegis:test', '{not json');
    const { result } = renderHook(() => useLocalStorage('aegis:test', 'fallback'));
    expect(result.current[0]).toBe('fallback');
  });

  it('persists updates so a later mount reads them back', () => {
    const { result, unmount } = renderHook(() => useLocalStorage<string[]>('aegis:test', []));

    act(() => {
      result.current[1](['POL-00002']);
    });

    expect(JSON.parse(localStorage.getItem('aegis:test') ?? 'null')).toEqual(['POL-00002']);

    unmount();

    const { result: second } = renderHook(() => useLocalStorage<string[]>('aegis:test', []));
    expect(second.current[0]).toEqual(['POL-00002']);
  });
});
