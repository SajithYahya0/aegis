import { render, screen, type ByRoleOptions } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App from './App';
import { store } from './shared/store';
import { QuoteProvider } from './shared/store/QuoteContext';
import { ThemeModeProvider } from './shared/theme/ThemeModeProvider';

/**
 * Budget for one lazy chunk to transform, import, and render. See the header —
 * this is a measured figure, not a number raised until the suite went green.
 */
const CHUNK_TIMEOUT_MS = 10_000;

/**
 * The provider stack mirrors `main.tsx`, in the same order and for the same
 * reasons — `Provider` → theme → router → `QuoteProvider`. None of it is
 * scaffolding to keep the suite quiet:
 *
 *   • No `Provider`: `RequireRole` calls `useAppSelector` and react-redux
 *     throws "could not find react-redux context value" before any route can
 *     render, so every test fails at the same place with the same message and
 *     none of them are about routing any more.
 *
 *   • No `ThemeModeProvider`: a MUI surface with no `ThemeProvider` above it
 *     falls back to MUI's *default* theme, which has no custom `status` key,
 *     so `StatusChip` on /dashboard reads `theme.palette.status[status].soft`
 *     off `undefined` and throws. Nesting it inside `MemoryRouter` instead
 *     would still pass here and still be wrong: it is the position above the
 *     router that keeps the theme alive across navigations and reaches
 *     portalled content.
 *
 *   • No `QuoteProvider`: `/quote`'s steps call `useQuote()`, whose guard
 *     throws by design.
 *
 * The store is the app's singleton rather than a fresh one per test, because
 * that is what `main.tsx` mounts and because the interceptor reads the same
 * singleton — a per-test store here would leave the transport and the UI
 * looking at two different sessions. Nothing in this file dispatches, so the
 * role stays `agent` and the /underwriting redirect test still means what it
 * says.
 */
function renderAt(path: string): void {
  render(
    <Provider store={store}>
      <ThemeModeProvider>
        <MemoryRouter initialEntries={[path]}>
          <QuoteProvider>
            <App />
          </QuoteProvider>
        </MemoryRouter>
      </ThemeModeProvider>
    </Provider>,
  );
}

/**
 * `findByRole` with the chunk budget instead of the 1000ms default. Every wait
 * in this file that depends on a lazy route resolving goes through here, so the
 * budget is stated once rather than re-argued per assertion.
 */
function findInChunk(role: string, options: ByRoleOptions): Promise<HTMLElement> {
  return screen.findByRole(role, options, { timeout: CHUNK_TIMEOUT_MS });
}

describe('route table', () => {
  it('resolves the dashboard chunk at /', async () => {
    renderAt('/');
    expect(await findInChunk('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('resolves the policy book chunk at /policies', async () => {
    renderAt('/policies');
    /*
     * The heading is the slow one — it is the first thing in the chunk, so
     * waiting for it is waiting for the whole mount. Once it lands the tab is
     * already in the DOM alongside it; the second wait is a scan, not a wait.
     */
    expect(await findInChunk('heading', { name: 'Policies' })).toBeInTheDocument();
    // Content from inside the chunk, not from AppLayout.
    expect(await findInChunk('tab', { name: 'Policy list' })).toBeInTheDocument();
  });

  it('resolves the claim intake chunk at /claims/new without loading the wizard', async () => {
    renderAt('/claims/new');
    expect(await findInChunk('button', { name: 'Start a claim' })).toBeInTheDocument();

    /*
     * The other half of W3-D3-02. `<Modal>` renders null while closed, so the
     * wizard element exists but is never rendered and its chunk is never
     * requested. If the modal were implemented as hidden-but-mounted, the
     * wizard would be in the DOM here and this assertion would catch it.
     */
    expect(screen.queryByRole('heading', { name: 'New claim', level: 2 })).not.toBeInTheDocument();
  });

  it('redirects /underwriting away from the default agent role', async () => {
    renderAt('/underwriting');
    // RequireRole sends an agent to the dashboard rather than rendering the
    // route, so the underwriting chunk must not appear.
    expect(await findInChunk('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Underwriting' })).not.toBeInTheDocument();
  });

  it('falls through to the 404 chunk for an unknown path', async () => {
    renderAt('/policies/POL-00001/nope/deeper');
    expect(await findInChunk('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});
