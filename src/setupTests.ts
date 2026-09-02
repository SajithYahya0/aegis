/**
 * WHY THIS EXISTS:
 *   Installs jest-dom's matchers into Vitest's `expect`, and unmounts every
 *   rendered tree between tests.
 *
 * CONCEPTS: W3-D2-06, W3-D2-07
 *
 * WITHOUT THIS:
 *   `expect(el).toBeInTheDocument()` fails with "toBeInTheDocument is not a
 *   function" — a TypeError that looks like a broken test file rather than a
 *   missing setup, and which no amount of staring at the component explains.
 *
 *   The cleanup matters more than it looks. Testing Library appends each render
 *   to `document.body` and does not remove it unless told to. Two tests that
 *   both render `PolicyList` would leave two lists mounted, so
 *   `getAllByRole('row')` in the second test returns both lists' rows and the
 *   filter assertion fails with double the expected count — a failure whose
 *   cause is the previous test, not the one that reported it. The leaked trees
 *   also keep their effects' intervals and abort controllers alive, so
 *   `useFetch`'s cleanup logs fire during unrelated tests.
 *
 *   `matchMedia` is absent from jsdom entirely — not stubbed, not partial,
 *   simply not implemented, because jsdom has no layout engine and therefore
 *   no media to match. Every test that mounts `AppLayout` renders the theme
 *   effect, which resolves the default 'system' choice against
 *   `prefers-color-scheme`, and without this shim all of them die on
 *   "window.matchMedia is not a function" — a failure in the layout's chrome
 *   that has nothing to do with what any of those tests assert.
 *
 *   The shim lives here rather than as a `typeof window.matchMedia ===
 *   'function'` guard in the component. A guard would put a branch in shipped
 *   code that exists only to satisfy a test environment, and it would branch
 *   the wrong way round: the real browser always has `matchMedia`, so the
 *   guarded path would be dead in production and the only code the tests
 *   exercise. Patching the environment keeps the component honest about what
 *   a browser provides.
 */

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
