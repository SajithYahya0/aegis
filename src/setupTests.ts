import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

/*
 * Reports "not dark" and never changes. Tests that care about the resolved
 * theme should override `matches` per test rather than making this default
 * clever — a shim that guessed would decide the theme for every test in the
 * suite from one place none of them mention.
 *
 * `addEventListener`/`removeEventListener` are real spies, not no-ops, so a
 * test can still assert that the theme effect detaches its listener on
 * unmount. That is the one thing about this code path worth checking, and a
 * bare `() => {}` would make it uncheckable.
 */
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as unknown as MediaQueryList,
});

afterEach(() => {
  cleanup();
});
