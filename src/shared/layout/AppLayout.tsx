/**
 * WHY THIS EXISTS:
 *   The chrome every route sits inside: sidebar nav, header with the role
 *   switcher, and the content region. One `<Outlet>` here is what lets
 *   `App.tsx` stay a pure route table — the layout that wraps every route is
 *   itself just another element in that table, not something `App.tsx` has
 *   to render by hand around each `<Route>`.
 *
 * CONCEPTS: W2-D4-04, W3-D3-05
 *
 * WITHOUT THIS:
 *   Every page component would have to import and render its own sidebar and
 *   header, so the active-nav-link logic exists in one copy per route instead
 *   of one copy total — and the moment one page's copy drifts (a missed
 *   route, a typo'd path), that page's sidebar silently disagrees with every
 *   other page's about which link is "active".
 *
 *   No preload on hover/focus: every route is its own chunk now, so a click on
 *   "Policies" starts a network round trip the user then waits through,
 *   watching a skeleton. The download only begins at the moment React renders
 *   the lazy element — that is, strictly after the click. But the intent to
 *   navigate becomes observable a few hundred milliseconds earlier, when the
 *   pointer lands on the link. Starting the fetch on `mouseenter` spends that
 *   otherwise-dead interval on the download, so by the time the click arrives
 *   the module is usually already resolved and the skeleton never paints.
 *   The same bytes are fetched either way; this changes only *when*, which is
 *   the difference between a visible loading state and none.
 *
 *   Hover alone would be an accessibility bug rather than a feature: a
 *   keyboard user tabbing through the sidebar never fires `mouseenter`, so
 *   they would take the slow path on every single navigation while mouse users
 *   took the fast one. `onFocus` is the keyboard-equivalent intent signal, and
 *   is wired alongside hover for exactly that reason.
 *
 *   `preloadPath` is idempotent (see `lazyRoutes.ts`), which is what makes it
 *   safe on two handlers that routinely both fire for the same link — focus
 *   follows click, so a mouse user usually triggers both within a few frames.
 */

import type { ReactElement } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ConnectivityBanner } from '../components/ConnectivityBanner';
import { AS_OF } from '../data';
import { formatDate } from '../format';
import { LabPanel } from '../labs';
import { preloadPath } from '../routes/lazyRoutes';
import { useAuth } from '../store/AuthContext';
import type { Role } from '../types';
import styles from './AppLayout.module.css';

const NAV_ITEMS: readonly { to: string; label: string; end?: boolean }[] = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/policies', label: 'Policies' },
  { to: '/quote', label: 'New quote' },
  { to: '/claims/new', label: 'New claim' },
  { to: '/underwriting', label: 'Underwriting' },
];

const ROLES: readonly Role[] = ['agent', 'underwriter'];

function navLinkClassName({ isActive }: { isActive: boolean }): string {
  return isActive ? styles.navLinkActive : styles.navLink;
}

export function AppLayout(): ReactElement {
  const { user, role, switchRole } = useAuth();

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>AEGIS</div>
        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={navLinkClassName}
              onMouseEnter={() => preloadPath(item.to)}
              onFocus={() => preloadPath(item.to)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <header className={styles.header}>
        <span className={styles.headerMeta}>Valuation date {formatDate(AS_OF)}</span>

        <div className={styles.roleSwitch}>
          <span className={styles.roleName}>
            {user.name} · {user.branch}
          </span>
          <label htmlFor="role-switcher">Viewing as</label>
          <select
            id="role-switcher"
            value={role}
            onChange={(event) => switchRole(event.target.value as Role)}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r === 'agent' ? 'Agent' : 'Underwriter'}
              </option>
            ))}
          </select>
        </div>
      </header>

      <main className={styles.main}>
        <ConnectivityBanner />
        <Outlet />
        {import.meta.env.DEV ? <LabPanel /> : null}
      </main>
    </div>
  );
}
