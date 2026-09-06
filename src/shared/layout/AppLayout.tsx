/**
 * WHY THIS EXISTS:
 *   The route table's layout element. It owns exactly three things: the
 *   `<Outlet>` every child route renders into, the app-wide connectivity
 *   banner that has to sit above it, and the dev-only `LabPanel` below it.
 *   The chrome around all three — app bar, nav drawer, role and theme
 *   controls — is `AppShell`.
 *
 * CONCEPTS: W2-D4-04, C-04
 *
 * WITHOUT THIS:
 *   Every page component would have to import and render its own chrome, so
 *   the nav exists in one copy per route instead of one copy total — and the
 *   moment one page's copy drifts (a missed route, a typo'd path), that page's
 *   nav silently disagrees with every other page's about which link is
 *   "active". As a `<Route element>` with an `<Outlet>`, the layout is itself
 *   just another entry in `App.tsx`'s route table rather than something
 *   `App.tsx` has to render by hand around each `<Route>`.
 *
 *   WHY THE CHROME IS NOT IN THIS FILE ANY MORE: it was, and the file was
 *   doing two unrelated jobs — deciding where routed content goes, and
 *   painting a header. The split is what lets the chrome be an MUI surface
 *   (see the Week 4 boundary in `CLAUDE.md`) while the content region stays
 *   agnostic about whether the route inside it is MUI or CSS Modules. Merged
 *   back together, the same file would have to import both a CSS Module and
 *   `AppBar`, which is precisely the mixing the boundary forbids.
 *
 *   WITHOUT ConnectivityBanner BEING HERE: it is mounted once, in the layout,
 *   so `useSyncExternalStore` is subscribed on every route. Moved into a page,
 *   the user goes offline while on a page that does not happen to mount it and
 *   is never told — they keep typing into a quote that cannot be saved.
 *
 *   It sits INSIDE `AppShell`'s content region rather than in the chrome
 *   deliberately: it is a CSS Modules component, and the content region is the
 *   side of the boundary CSS Modules is allowed on. `LabPanel` is here for the
 *   same two reasons — it is a CSS Modules component, and it has to be on
 *   every route.
 *
 *   WITHOUT THE LabPanel MOUNT: every registered defect in
 *   `src/shared/labs/registry.ts` becomes unreachable at once. The toggles
 *   still exist, `isLabEnabled` still answers, and nothing anywhere throws —
 *   the defects simply can never be switched on, so six demos
 *   (W2-D1-05, W2-D1-06, W2-D3-02, W3-D2-01, W3-D4-03, W4-D3-04 and C-05)
 *   silently become claims in prose. This mount was commented out in
 *   `fa744c4` with no note and stayed that way through the `AppShell`
 *   rebuild, while `README.md`, `docs/failure-modes.md`, `docs/qa-drills.md`
 *   and two rows of `docs/coverage-matrix.md` went on describing a panel that
 *   was not in the tree. That is the failure mode worth naming here: a
 *   commented-out mount point compiles, tests green, and takes a whole
 *   category of demonstrable evidence with it. `import.meta.env.DEV` is the
 *   gate — it keeps the panel out of a production bundle without ever
 *   removing it from the source, which is what makes commenting it out
 *   unnecessary in the first place.
 */

import { type ReactElement } from 'react';
import { Outlet } from 'react-router-dom';
import { ConnectivityBanner } from '../components/ConnectivityBanner';
import { LabPanel } from '../labs';
import { AppShell } from './AppShell';

export function AppLayout(): ReactElement {
  return (
    <AppShell>
      <ConnectivityBanner />
      <Outlet />
      {import.meta.env.DEV ? <LabPanel /> : null}
    </AppShell>
  );
}
