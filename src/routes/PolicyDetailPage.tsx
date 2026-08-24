/**
 * WHY THIS EXISTS:
 *   The `/policies/:id` shell: reads the id out of the URL and renders the
 *   Coverage / Claims / Documents tabs as nested routes under its own
 *   `<Outlet>`, rather than as three conditionally-rendered divs switched by
 *   local state.
 *
 * CONCEPTS: W2-D4-03, W2-D4-05
 *
 * WITHOUT THIS:
 *   Three divs toggled by a `useState<'coverage' | 'claims' | 'documents'>`
 *   would work, but the active tab would not survive a reload, a bookmark, or
 *   the browser's back button — `/policies/POL-00012/claims` would not be a
 *   real, shareable address, it would just be `/policies/POL-00012` that
 *   happens to be showing claims right now because of client state nobody
 *   else can see.
 */

import type { ReactElement } from 'react';
import { NavLink, Outlet, useParams } from 'react-router-dom';

function tabClassName({ isActive }: { isActive: boolean }): string {
  return isActive ? 'active' : '';
}

export default function PolicyDetailPage(): ReactElement {
  const { id } = useParams<{ id: string }>();

  return (
    <div>
      <h1>Policy {id}</h1>

      <nav>
        <NavLink to="." end className={tabClassName}>
          Coverage
        </NavLink>{' '}
        <NavLink to="claims" className={tabClassName}>
          Claims
        </NavLink>{' '}
        <NavLink to="documents" className={tabClassName}>
          Documents
        </NavLink>
      </nav>

      <Outlet />
    </div>
  );
}
