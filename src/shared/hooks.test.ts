import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLocalStorage } from './hooks';

const KEY = 'aegis.recent-policies';

interface RecentPolicy {
  id: string;
}

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('keeps a value written while the component is navigating away', () => {
    const { result, unmount } = renderHook(() => useLocalStorage<RecentPolicy[]>(KEY, []));

    act(() => {
      result.current[1]([{ id: 'POL-1001' }]);
      unmount();
    });

    expect(localStorage.getItem(KEY)).toBe('[{"id":"POL-1001"}]');
  });

  it('reads the stored value back on the next mount', () => {
    localStorage.setItem(KEY, '[{"id":"POL-1007"}]');

    const { result } = renderHook(() => useLocalStorage<RecentPolicy[]>(KEY, []));

    expect(result.current[0]).toEqual([{ id: 'POL-1007' }]);
  });
});
