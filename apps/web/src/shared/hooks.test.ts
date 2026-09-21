import {act, renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {useDebounce} from './hooks';

describe('useDebounce', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('emits only the last of three quick changes', () => {
        const {result, rerender} = renderHook(({value}) => useDebounce(value, 300), {
            initialProps: {value: 'a'},
        });

        rerender({value: 'b'});
        rerender({value: 'c'});
        rerender({value: 'd'});
        expect(result.current).toBe('a');

        act(() => vi.advanceTimersByTime(300));
        expect(result.current).toBe('d');
    });
});
