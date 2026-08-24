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
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import App from './App';

function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('route table', () => {
  it('resolves the dashboard chunk at /', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('resolves the policy book chunk at /policies', async () => {
    renderAt('/policies');
    expect(await screen.findByRole('heading', { name: 'Policies' })).toBeInTheDocument();
    // Content from inside the chunk, not from AppLayout.
    expect(await screen.findByRole('tab', { name: 'Policy list' })).toBeInTheDocument();
  });

  it('resolves the claim intake chunk at /claims/new without loading the wizard', async () => {
    renderAt('/claims/new');
    expect(await screen.findByRole('button', { name: 'Start a claim' })).toBeInTheDocument();

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
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Underwriting' })).not.toBeInTheDocument();
  });

  it('falls through to the 404 chunk for an unknown path', async () => {
    renderAt('/policies/POL-00001/nope/deeper');
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});
