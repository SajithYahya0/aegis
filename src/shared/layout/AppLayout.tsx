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
 *
 *   THEME — AND WHY THIS FILE NO LONGER OWNS IT. The theme choice, its
 *   `useLocalStorage` call, the `'system'` resolution and the `matchMedia`
 *   listener all used to live here, and this header used to argue at length
 *   that a theme context would be wrong: nothing below read the value, the
 *   tokens in `global.css` did all the work off one attribute on `<html>`, so
 *   a provider would broadcast a re-render to the whole tree to deliver a
 *   value with no consumers. That argument was correct while the app was
 *   CSS-only. Week 4 falsified its premise — MUI resolves colour from a theme
 *   *object* in React context at render time, and `ThemeProvider` has to sit
 *   above the router (see `main.tsx`), which is above this component.
 *
 *   Keeping the state here as well would not have been a second opinion, it
 *   would have been a second *copy*: two `useLocalStorage('aegis.theme')`
 *   calls share a key, not state, so each holds its own `useState` and a
 *   click on the switcher below would move one and leave the other on its
 *   mount-time value. The visible failure is the CSS Modules routes flipping
 *   to dark while every MUI surface stays light until a reload.
 *
 *   So the state moved up to `ThemeModeProvider` and this file reads it
 *   through `useThemeChoice()`. The old objection survives only in its narrow
 *   form and is handled there: the context value is memoised on the choice, so
 *   it changes on a theme change and at no other time — a keystroke in the
 *   /policies search box still does not reach it, which is what keeps the
 *   render-count logs meaningful.
 *
 *   `useLocalStorage` still has two consumers, just not two here: the
 *   recently-viewed list on /policies and the theme choice one level up. That
 *   is worth stating because a hook with a single caller is indistinguishable
 *   from a function that should have been inlined, and two callers holding
 *   unrelated value types — a list of policy ids there, a `ThemeChoice` union
 *   there — are what make its generic parameter load-bearing rather than
 *   decorative.
 */

import { type ReactElement } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ConnectivityBanner } from '../components/ConnectivityBanner';
import { AS_OF } from '../data';
import { formatDate } from '../format';
// import { LabPanel } from '../labs';
import { preloadPath } from '../routes/lazyRoutes';
import { useAuth } from '../store/AuthContext';
import { useThemeChoice, type ThemeChoice } from '../theme/ThemeModeProvider';
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

const THEME_OPTIONS: readonly { value: ThemeChoice; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

function navLinkClassName({ isActive }: { isActive: boolean }): string {
  return isActive ? styles.navLinkActive : styles.navLink;
}

export function AppLayout(): ReactElement {
  const { user, role, switchRole } = useAuth();
  const { choice, setChoice } = useThemeChoice();

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

          <label htmlFor="theme-switcher">Theme</label>
          <select
            id="theme-switcher"
            value={choice}
            onChange={(event) => setChoice(event.target.value as ThemeChoice)}
          >
            {THEME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <main className={styles.main}>
        <ConnectivityBanner />
        <Outlet />
        {/* {import.meta.env.DEV ? <LabPanel /> : null} */}
      </main>
    </div>
  );
}
