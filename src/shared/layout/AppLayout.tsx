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
 *   THEME. The layout owns the theme choice because it is the only component
 *   that mounts once and outlives every route, so the effect that writes
 *   `data-theme` runs on a real change of intent rather than on every
 *   navigation. It is deliberately NOT a context: nothing below reads the
 *   value — the tokens in `global.css` do all the work off one attribute on
 *   `<html>` — so a provider would broadcast a re-render to the entire tree to
 *   deliver a value with no consumers, and would defeat the memoisation the
 *   render-count logs exist to demonstrate.
 *
 *   This is `useLocalStorage`'s second consumer (the first is the
 *   recently-viewed list on /policies). Nothing about the hook changes; it is
 *   worth stating only because a hook with a single caller is
 *   indistinguishable from a function that should have been inlined, and two
 *   callers holding unrelated value types — a list of policy ids there, a
 *   `ThemeChoice` union here — are what make its generic parameter
 *   load-bearing rather than decorative.
 *
 *   WITHOUT THE 'system' RESOLUTION: `data-theme` can only ever be 'light' or
 *   'dark', because CSS has no way to express "whatever the OS says" through
 *   an attribute. Writing `data-theme="system"` would match no selector at
 *   all and fall through to the light `:root` tokens — so a dark-OS user on
 *   the default setting would silently get a white app. 'system' is therefore
 *   resolved here against `matchMedia` and written out as a concrete theme.
 *
 *   WITHOUT THE matchMedia LISTENER: the OS preference is read once at mount
 *   and never again. A user on System whose machine flips to dark at sunset —
 *   or who toggles it in Settings with this tab open — keeps the light palette
 *   until they reload, which reads as the System option being broken. The
 *   listener is removed in the effect's cleanup because it is registered on a
 *   `MediaQueryList` that lives as long as the window: a leaked handler
 *   outlives unmount and goes on writing `data-theme` on behalf of a
 *   component that no longer exists. StrictMode's double-mount is what makes
 *   that leak observable in dev instead of in production.
 */

import { useEffect, type ReactElement } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ConnectivityBanner } from '../components/ConnectivityBanner';
import { AS_OF } from '../data';
import { formatDate } from '../format';
import { useLocalStorage } from '../hooks/useLocalStorage';
// import { LabPanel } from '../labs';
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

/*
 * What the user picks — not what gets painted. 'system' is a choice, not a
 * resolved theme: it is the third state meaning "keep following the OS", which
 * is why it has to survive a reload as itself. Persisting the resolved 'dark'
 * instead would pin the user to dark permanently the first time their OS
 * happened to be dark, and the System option would become a one-way door.
 */
type ThemeChoice = 'light' | 'dark' | 'system';

const THEME_KEY = 'aegis.theme';

const THEME_OPTIONS: readonly { value: ThemeChoice; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

const DARK_QUERY = '(prefers-color-scheme: dark)';

function navLinkClassName({ isActive }: { isActive: boolean }): string {
  return isActive ? styles.navLinkActive : styles.navLink;
}

export function AppLayout(): ReactElement {
  const { user, role, switchRole } = useAuth();
  const [theme, setTheme] = useLocalStorage<ThemeChoice>(THEME_KEY, 'system');

  useEffect(() => {
    const root = document.documentElement;

    /*
     * Hand colour back to the stylesheet. The bootstrap script in `index.html`
     * sets `color-scheme` as an inline style so the browser has a dark canvas
     * before any CSS exists; an inline style outranks a stylesheet, so leaving
     * it there would mean a user who later picks Light keeps dark scrollbars
     * and a dark native date picker for the rest of the session. React is
     * running by the time this fires, so the tokens are loaded and the
     * `[data-theme]` block can take over.
     */
    root.style.removeProperty('color-scheme');

    /*
     * An explicit choice needs no subscription: 'light' and 'dark' are already
     * concrete. Listening for OS changes here as well would let the OS repaint
     * an app the user has deliberately pinned.
     */
    if (theme !== 'system') {
      root.dataset.theme = theme;
      return;
    }

    const query = window.matchMedia(DARK_QUERY);

    const apply = (matches: boolean): void => {
      root.dataset.theme = matches ? 'dark' : 'light';
    };

    apply(query.matches);

    const onChange = (event: MediaQueryListEvent): void => apply(event.matches);

    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [theme]);

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
            value={theme}
            onChange={(event) => setTheme(event.target.value as ThemeChoice)}
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
