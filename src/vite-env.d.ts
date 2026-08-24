/**
 * WHY THIS EXISTS:
 *   Pulls in Vite's ambient client types, which include the module declaration
 *   for `*.module.css`.
 *
 * CONCEPTS: W1-12
 *
 * WITHOUT THIS:
 *   `import styles from './PolicyRow.module.css'` is a hard TypeScript error —
 *   "Cannot find module ... or its corresponding type declarations" — on every
 *   component in the app. Vite itself would still serve the page, so `npm run
 *   dev` looks fine while `npm run build` and the editor are both red, which is
 *   the worst version of this failure: broken only where it is not being
 *   watched. CSS Modules are a curriculum item (W1-12), so this is not
 *   optional plumbing.
 */

/// <reference types="vite/client" />
