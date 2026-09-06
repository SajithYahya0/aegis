/**
 * WHY THIS EXISTS:
 *   The one and only entry point. Creates the React 19 root, installs the
 *   single `BrowserRouter`, and pulls in the global stylesheet.
 *
 * CONCEPTS: W2-D4-01, W4-D1-01, W4-D4-01, W4-D4-05
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
 *
 *   `ThemeModeProvider` (MUI `ThemeProvider` + `CssBaseline`) wraps the Router
 *   rather than sitting inside it. Below the Router it would be inside a route
 *   element, and the theme would reach only that route's subtree — every
 *   `styled()` component outside it would silently fall back to MUI's default
 *   theme, `theme.palette.status` would be `undefined` there, and `body` would
 *   keep whatever background the last route left on it. It also wraps `App`
 *   rather than being mounted inside it, so a navigation cannot unmount and
 *   remount it: the theme object is created once per mode, not once per route
 *   change.
 *
 *   THE PROVIDER ORDER IS `Provider` → `ThemeModeProvider` → `BrowserRouter`
 *   → `QuoteProvider`, and each step is forced by the one below it:
 *
 *   • `Provider store` is outermost because it is the only one of the four
 *     with a consumer *outside* React entirely. The axios request interceptor
 *     reads `store.getState().auth.token` on every outgoing request, and those
 *     requests can be fired before this tree has committed. It also has to sit
 *     above the Router, because `RequireRole` — a route element — selects the
 *     role from it: a store mounted inside the Router would be inside the
 *     thing that depends on it.
 *
 *   • `ThemeModeProvider` next, for the reason spelled out above: below the
 *     Router it would live inside one route's element and the theme would
 *     reach only that route's subtree. It goes under the store rather than
 *     over it because nothing about the theme needs Redux today and the
 *     narrower scope is the one to keep.
 *
 *   • `BrowserRouter` next, so everything below it can navigate.
 *
 *   • `QuoteProvider` innermost, and mounted here at all so that the two state
 *     approaches are visibly siblings: `Provider store` (Redux Toolkit, the
 *     session) and `QuoteProvider` (Context + `useReducer`, the wizard draft)
 *     wrap the same tree, and W4-D4-05's claim that the app runs both at once
 *     is something a reader can check in eight lines rather than take on
 *     trust. It moved out of `App.tsx`'s `/quote` route element, where it was
 *     scoped to one route; below the Router it stays, because the wizard's
 *     `RESET` navigates and the provider must outlive that.
 *
 *   Getting this order wrong does not error. `QuoteProvider` above
 *   `BrowserRouter` still renders; it simply cannot use a router hook, and the
 *   day the wizard needs one the fix is four files away from the symptom.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { store } from './shared/store';
import { QuoteProvider } from './shared/store/QuoteContext';
import { ThemeModeProvider } from './shared/theme/ThemeModeProvider';
import './styles/global.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('#root is missing from index.html — nothing can be mounted.');
}

createRoot(container).render(
  <StrictMode>
    <Provider store={store}>
      <ThemeModeProvider>
        <BrowserRouter>
          <QuoteProvider>
            <App />
          </QuoteProvider>
        </BrowserRouter>
      </ThemeModeProvider>
    </Provider>
  </StrictMode>,
);
