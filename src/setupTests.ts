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
 */

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
