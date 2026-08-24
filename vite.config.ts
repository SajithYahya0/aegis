/**
 * WHY THIS EXISTS:
 *   Single build + test config. Wires @vitejs/plugin-react for Fast Refresh and
 *   the automatic JSX runtime, and points Vitest at jsdom with a setup file.
 *
 * CONCEPTS: W3-D2-06, W3-D2-07
 *
 * WITHOUT THIS:
 *   `environment: 'jsdom'` missing means every Testing Library render throws
 *   "document is not defined". `setupFiles` missing means `toBeInTheDocument`
 *   is undefined at assertion time, so component tests fail with a TypeError
 *   instead of a useful diff. `passWithNoTests` missing means `npx vitest run`
 *   exits 1 on a repo that has not written its first test yet, which would
 *   make the Phase 0 acceptance check impossible to pass.
 */
/// <reference types="vitest" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Resolved absolutely rather than left as `'./src/setupTests.ts'`. A relative
 * setup path is joined against the process working directory, not this file's
 * directory, so running the suite from a parent folder — which is exactly what
 * happens when this project sits inside a larger git repo — looks for
 * `../src/setupTests.ts` and fails the whole suite with "Failed to load url"
 * before a single test collects.
 */
const setupFile = fileURLToPath(new URL('./src/setupTests.ts', import.meta.url));

export default defineConfig({
  plugins: [react()],
  server: {
    // StackBlitz WebContainer: filesystem watching is unreliable, so lean on
    // polling rather than native fs events.
    watch: { usePolling: true },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [setupFile],
    passWithNoTests: true,
    // CSS Modules are a curriculum item; resolving them in tests means a
    // `styles.active` class assertion reads a real generated name, not undefined.
    css: true,
  },
});
