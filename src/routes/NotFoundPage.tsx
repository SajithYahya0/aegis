/**
 * WHY THIS EXISTS:
 *   The `*` catch-all route. Every URL that does not match a defined route —
 *   a typo'd policy id, a stale bookmark, a link copied from an old build —
 *   lands here instead of a blank page.
 *
 * CONCEPTS: W2-D4-10
 *
 * WITHOUT THIS:
 *   `react-router` renders nothing for an unmatched path: no error, no
 *   fallback, just an empty content region inside the layout shell. That is
 *   indistinguishable from a bug in the route table itself, so there is no
 *   way for an agent — or a reviewer clicking through routes — to tell "this
 *   URL genuinely does not exist" from "the app is broken".
 */

import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

export default function NotFoundPage(): ReactElement {
  return (
    <div>
      <h1>Page not found</h1>
      <p>
        <Link to="/">Return to the dashboard</Link>
      </p>
    </div>
  );
}
