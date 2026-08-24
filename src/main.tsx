/**
 * WHY THIS EXISTS:
 *   The one and only entry point. Creates the React 19 root, installs the
 *   single `BrowserRouter`, and pulls in the global stylesheet.
 *
 * CONCEPTS: W2-D4-01
 *
 * WITHOUT THIS:
 *   No router context exists, so the first `<Routes>`, `<NavLink>` or
 *   `useNavigate()` anywhere in the tree throws "useNavigate() may be used only
 *   in the context of a <Router> component" and the whole app renders blank —
 *   there is no boundary above `App`, so it is a white screen with a console
 *   error, not a fallback.
 *
 *   The Router lives HERE and nowhere else. Putting a second `<BrowserRouter>`
 *   in `App.tsx` does not error: the inner router quietly wins for everything
 *   below it while the outer one still owns `window.history`. The symptom is
 *   that a `<Link>` updates the URL but the matched route never changes, or
 *   changes and then snaps back — a silent desync that looks like a routing
 *   bug in the route table rather than a duplicated provider.
 *
 *   `StrictMode` stays on deliberately. In development it double-invokes
 *   renders and mounts each effect twice (mount → cleanup → mount). That is not
 *   noise to be silenced: it is the check that every `useEffect` cleanup in
 *   this app — the `AbortController` in `useFetch`, the `clearInterval` in the
 *   renewal countdown — actually works. Render-count logs in memoised
 *   components will therefore appear twice in dev; the comparison between
 *   memoised and un-memoised components is what the logs are for, and doubling
 *   both sides leaves that comparison intact.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/global.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('#root is missing from index.html — nothing can be mounted.');
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
