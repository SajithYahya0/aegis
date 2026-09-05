/**
 * WHY THIS EXISTS:
 *   The route table's layout element. It owns exactly two things: the
 *   `<Outlet>` every child route renders into, and the app-wide connectivity
 *   banner that has to sit above it. The chrome around both — app bar, nav
 *   drawer, role and theme controls — is `AppShell`.
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
 *   side of the boundary CSS Modules is allowed on.
 */

import { type ReactElement } from 'react';
import { Outlet } from 'react-router-dom';
import { ConnectivityBanner } from '../components/ConnectivityBanner';
// import { LabPanel } from '../labs';
import { AppShell } from './AppShell';

export function AppLayout(): ReactElement {
  return (
    <AppShell>
      <ConnectivityBanner />
      <Outlet />
      {/* {import.meta.env.DEV ? <LabPanel /> : null} */}
    </AppShell>
  );
}
