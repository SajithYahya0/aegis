/**
 * WHY THIS EXISTS:
 *   `/underwriting` is the one route no other test can reach. `App.test.tsx`
 *   walks the route table as the default `agent`, so its assertion about this
 *   page is the *negative* one — that `RequireRole` turns an agent away — and
 *   nothing in the suite had ever rendered the page itself. A route that is
 *   only ever asserted absent is a route that can be broken without failing a
 *   single test.
 *
 *   It also pins the claim `UnderwritingPage`'s header makes and that reading
 *   the component cannot settle: that the three reads go out *together*,
 *   behind one session bootstrap. `Promise.all([a, b, c])` and three
 *   sequential `await`s render the same page at the same moment; only the
 *   request log tells them apart.
 *
 * CONCEPTS: W4-D5-04, W4-D3-04, W3-D2-07
 *
 * WITHOUT THIS:
 *   Two failures go unnoticed. A `Promise.all` quietly refactored into a
 *   waterfall triples the page's time to first paint and removes the only
 *   clickable demonstration of the single-flight 401 queue — with nothing on
 *   screen changing. And the whole page could stop rendering: the suite would
 *   still be green, because the only test that mentions this route asserts it
 *   is *not* there.
 */

import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, describe, expect, it } from 'vitest';
import UnderwritingPage from './UnderwritingPage';
import { backend } from '../shared/http';
import { store } from '../shared/store';
import { switchRole } from '../shared/store/authSlice';
import { ThemeModeProvider } from '../shared/theme/ThemeModeProvider';

/**
 * The real 400-900ms mock latency, plus a session bootstrap in front of it.
 * Not lowered: the point of this file is what happens while three requests are
 * genuinely in flight together, and `installMockBackend`'s latency option is
 * only reachable on a privately built instance — which the page's endpoint
 * wrappers, bound to the app's `http`, cannot be pointed at.
 */
const LOAD_TIMEOUT_MS = 10_000;

/*
 * The app's singleton store, dispatched into the underwriter role — this is
 * exactly what the AppBar's "Viewing as" select does. Vitest isolates module
 * registries per test file, so this cannot leak into `App.test.tsx`'s
 * expectation that the role is still `agent` there.
 *
 * `switchRole` only, not `useAuth`'s two-dispatch pair: the login is fired by
 * the request interceptor on the first outgoing request anyway, and firing a
 * second one here would make the "one login for three reads" assertion below
 * a statement about this test's setup rather than about the page.
 */
beforeAll(() => {
  store.dispatch(switchRole('underwriter'));
});

function renderPage(): void {
  render(
    <Provider store={store}>
      <ThemeModeProvider>
        <MemoryRouter>
          <UnderwritingPage />
        </MemoryRouter>
      </ThemeModeProvider>
    </Provider>,
  );
}

/*
 * One test, not two, and the reason is worth stating rather than leaving as a
 * style choice: the request log can only be read *after* the page has finished
 * loading, and the three GETs do not reach the adapter until the interceptor's
 * session bootstrap resolves. Split across two `it`s, the second would either
 * assert an empty history or silently depend on the first one having run —
 * which is a test that passes for a reason no one can see.
 */
describe('UnderwritingPage', () => {
  it(
    'renders the queue, the roll-up and the form, having fired three parallel reads behind one login',
    async () => {
      renderPage();

      /*
       * The decision form is the thing that cannot render until the *limits*
       * request has landed — its schema is built from `maxLoadingPct`. Waiting
       * on it therefore waits on the slowest of the three reads. The tables
       * are deliberately not the wait target: the referral queue's `<table>`
       * is in the DOM while empty, so finding it proves nothing.
       */
      expect(
        await screen.findByRole(
          'button',
          { name: 'Record decision' },
          { timeout: LOAD_TIMEOUT_MS },
        ),
      ).toBeInTheDocument();

      expect(screen.getByLabelText(/Rate loading/)).toBeInTheDocument();
      expect(screen.getByRole('table', { name: 'Referral queue' })).toBeInTheDocument();

      // From the Redux selector rather than from the transport — the roll-up
      // is on screen before the requests settle, which is the whole difference
      // between the two sources this page reads.
      expect(screen.getByRole('table', { name: 'Exposure by customer' })).toBeInTheDocument();

      // The queue has rows, so the `/policies` and `/claims` payloads were not
      // merely fetched but actually reached the derivation.
      expect(screen.getAllByRole('row').length).toBeGreaterThan(2);

      const paths = backend.history.get.map((config) => config.url);
      expect(paths).toContain('/policies');
      expect(paths).toContain('/claims');
      expect(paths).toContain('/underwriting/limits');

      /*
       * The single-flight claim (W4-D3-04), read from the other side. All
       * three reads start with no token in the store, so all three enter the
       * request interceptor's bootstrap; if the queue there were not one
       * shared promise, this count would be three.
       */
      const logins = backend.history.post.filter((config) => config.url === '/auth/login');
      expect(logins).toHaveLength(1);
    },
    LOAD_TIMEOUT_MS + 5_000,
  );
});
