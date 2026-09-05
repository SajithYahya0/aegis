/**
 * WHY THIS EXISTS:
 *   Mounts the real route table and walks it, one entry per test. Every route
 *   is now a `React.lazy` component behind a `<Suspense>` and an
 *   `<ErrorBoundary>`, and none of that wiring is checked by the type system:
 *   a lazy module with a named-only export, a route element pointing at the
 *   wrong chunk, or a provider left outside a boundary all compile cleanly and
 *   fail at runtime, on that route only.
 *
 * CONCEPTS: W3-D3-01, W3-D3-03, W3-D5-05, W2-D4-02, W2-D4-10, W3-D2-07
 *
 * WITHOUT THIS:
 *   `docs/coverage-matrix.md` ends with "open the app, click every route, and
 *   confirm each row's file is actually reached" — a manual pass that has to be
 *   redone by hand after every change and that nothing enforces in between.
 *   Code splitting makes that gap considerably worse than it was: before this
 *   phase a broken import failed the build, so it could not reach a browser.
 *   Now a route's module is only resolved when someone navigates to it, so the
 *   same mistake builds, deploys, and breaks exactly one page — the one nobody
 *   opened before shipping. These tests are that click-through, run every time.
 *
 *   Each assertion deliberately waits for content that lives *inside* the lazy
 *   chunk rather than in the layout, so it can only pass if the chunk actually
 *   resolved through its Suspense boundary. Asserting on the sidebar would pass
 *   even with every route module broken.
 *
 *   Every wait here goes through `findInChunk`, never a bare `findBy*`, and
 *   that is the fix for a test that used to fail perhaps one run in three on
 *   `/policies` with "Unable to find role=heading and name Policies" — a page
 *   whose `<h1>` is the very first thing its component returns. The message was
 *   misleading: nothing was missing, the wait had simply expired. Timed, the
 *   `/policies` mount is ~1.1–2.0s in this environment, in two parts, and
 *   neither part is removable:
 *
 *     • ~500–700ms resolving the lazy chunk. Under Vitest there is no
 *       pre-built bundle — `import('./routes/PoliciesPage')` transforms that
 *       module and everything below it (the seed data, `rating.ts`, every
 *       policies component) on demand, at the moment React first renders the
 *       lazy element. That cost is the thing these tests exist to assert, so
 *       pre-warming it away would assert less than it does now.
 *
 *     • ~350ms committing the page: `rateBook` over 140 policies, then 140
 *       memoised rows each emitting the `[render]` logs CLAUDE.md requires and
 *       Vitest funnels through its reporter.
 *
 *   Against that, dom-testing-library's 1000ms default is not a safety margin,
 *   it is a coin flip — and it is the wrong default for the job, having been
 *   chosen for "a state update settles", not "a bundler transforms a module
 *   graph and a 140-row table renders". `CHUNK_TIMEOUT_MS` is that budget
 *   stated explicitly, sized from the measurement with room for a cold or
 *   loaded machine (StackBlitz's WebContainer is slower than a local run).
 *
 *   It costs nothing on the failure path worth caring about: a route whose
 *   chunk is genuinely broken rejects its import, and the rejection surfaces
 *   through the ErrorBoundary as a render — not as a wait that has to expire.
 *   Only a route that hangs forever pays the full timeout, and that is a
 *   failure mode worth waiting to be sure about.
 */

import { render, screen, type ByRoleOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App from './App';
import { ThemeModeProvider } from './shared/theme/ThemeModeProvider';

/**
 * Budget for one lazy chunk to transform, import, and render. See the header —
 * this is a measured figure, not a number raised until the suite went green.
 */
const CHUNK_TIMEOUT_MS = 10_000;

/**
 * The provider stack mirrors `main.tsx`: `ThemeModeProvider` outside the
 * router, exactly where the real app mounts it. It is not scaffolding to keep
 * the suite quiet — a MUI surface rendered with no `ThemeProvider` above it
 * falls back to MUI's *default* theme, which has no custom `status` key, so
 * `StatusChip` on /dashboard reads `theme.palette.status[status].soft` off
 * `undefined` and throws. Nesting it inside `MemoryRouter` instead would still
 * pass here and still be wrong: it is the position above the router that keeps
 * the theme alive across navigations and reaches portalled content.
 */
function renderAt(path: string): void {
  render(
    <ThemeModeProvider>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </ThemeModeProvider>,
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
