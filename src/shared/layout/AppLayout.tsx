/**
 * WHY THIS EXISTS:
 *   The chrome every route sits inside: sidebar nav, header with the role
 *   switcher, and the content region. One `<Outlet>` here is what lets
 *   `App.tsx` stay a pure route table — the layout that wraps every route is
 *   itself just another element in that table, not something `App.tsx` has
 *   to render by hand around each `<Route>`.
 *
 * CONCEPTS: W2-D4-04
 *
 * WITHOUT THIS:
 *   Every page component would have to import and render its own sidebar and
 *   header, so the active-nav-link logic exists in one copy per route instead
 *   of one copy total — and the moment one page's copy drifts (a missed
 *   route, a typo'd path), that page's sidebar silently disagrees with every
 *   other page's about which link is "active".
 */

import type { ReactElement } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { AS_OF } from '../data';
import { formatDate } from '../format';
import { LabPanel } from '../labs';
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
            <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClassName}>
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
        <Outlet />
        {import.meta.env.DEV ? <LabPanel /> : null}
      </main>
    </div>
  );
}
