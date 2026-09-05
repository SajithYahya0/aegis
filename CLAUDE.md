# AEGIS — Policy & Claims Console

A React 19 demo application built to demonstrate **complete coverage** of a fixed
React curriculum (Weeks 1–4). This is a competency-demonstration artifact, not a
product. Read `docs/coverage-matrix.md` before writing any code.

---

## Prime directive

Every concept listed in `docs/coverage-matrix.md` must appear in shipped,
running application code — not in comments, not in a `examples/` folder, not
stubbed. A concept is "done" only when:

1. It is used in a component or hook that is reachable from a route the user can
   click to.
2. Its row in `docs/coverage-matrix.md` has been updated with the real file path
   and export name.
3. Its file carries the required header block (see below).

**Never mark a matrix row complete without updating the matrix file in the same
commit.** At the end of every phase, re-read the matrix and report which rows are
still unchecked.

---

## Stack — pinned, do not change

| Thing                     | Version |
| ------------------------- | ------- |
| react / react-dom         | 19.x    |
| vite                      | 5.x     |
| @vitejs/plugin-react      | 4.x     |
| react-router-dom          | 6.26.2  |
| typescript                | 5.x     |
| vitest                    | 2.1.8   |
| jsdom                     | 25.x    |
| @testing-library/react    | 16.3.0  |
| @testing-library/jest-dom | 6.6.3   |

Weeks 1–3 surfaces are CSS Modules + hand-rolled state, and STAY that way. They
are the control group: they exist to be contrasted against the Week 4 surfaces.
Do not migrate them.

Week 4 adds, and only on the surfaces named in `docs/coverage-matrix.md`:

- `@mui/material`, `@emotion/react`, `@emotion/styled`, `@mui/icons-material`
- `axios`, `axios-mock-adapter`
- `@reduxjs/toolkit`, `react-redux`
- `react-hook-form`, `zod`, `@hookform/resolvers`

Nothing else. No TanStack Query, no Tailwind, no component library beyond MUI.

`date-fns` is permitted for date arithmetic. Nothing else without asking.

---

## Week 4 boundary

The split below is deliberate and load-bearing. Weeks 1–3 are the control group:
hand-rolled reducers, hand-rolled fetch-with-`AbortSignal`, hand-rolled form
state, CSS Modules. Week 4 re-solves the *same* problems with libraries. Keeping
both alive is what makes the comparison demonstrable — "here is the `useReducer`
version, here is the Redux Toolkit version, and here is why each is the way it
is." Migrating the Week 1–3 surfaces would delete the evidence and leave only
the libraries, which is the one outcome this exercise is built to avoid.

| Surface                              | Styling / state    |
| ------------------------------------ | ------------------ |
| `/dashboard`                         | MUI (new)          |
| `/underwriting`                      | MUI (new)          |
| AppBar + theme toggle in `AppLayout` | MUI (new)          |
| `ClaimIntakeWizard`                  | MUI (new)          |
| `/policies`                          | CSS Modules (kept) |
| `/policies/:id`                      | CSS Modules (kept) |
| `/quote`                             | CSS Modules (kept) |

To be explicit: a mixed-styling app here is **finished**, not half-migrated. If
a reviewer asks why `/policies` is not MUI, the answer is that it is the
baseline the MUI routes are measured against. Do not "tidy" this up. Do not
introduce MUI components into a CSS Modules surface, and do not introduce CSS
Modules into a MUI surface — the boundary is the artifact.

---

## Environment: StackBlitz WebContainer

The preview target is StackBlitz. This constrains things:

- No Node-only APIs, no filesystem access, no native deps.
- Watch mode is unreliable — tests run with `npx vitest run`, never `--watch`.
- Test files must be `.test.ts` / `.test.tsx`. A `.tsx.ts` suffix breaks JSX
  parsing and Vitest discovery.
- Keep `index.html` and `vite.config.ts` at the repo root, standard Vite layout.

---

## Required file header

Every `.ts` / `.tsx` file under `src/` opens with this block. No exceptions, and
no filler — if a file has no interesting failure mode, it probably should not be
its own file.

```ts
/**
 * WHY THIS EXISTS:
 *   <one or two sentences — what job this file does>
 *
 * CONCEPTS: <comma-separated matrix IDs, e.g. W3-D1-02, W2-D3-01>
 *
 * WITHOUT THIS:
 *   <the concrete failure. Not "it would be less clean." Describe the actual
 *    broken behaviour: what re-renders, what leaks, what goes stale, what
 *    crashes, what the user sees.>
 */
```

The `WITHOUT THIS` line is the most important line in the file. It is the format
the reviewer expects answers in: _"I implemented X, otherwise Y would happen."_
Write it as if being asked to defend the decision under pressure.

---

## Architecture rules

- `src/shared/` is the import boundary. Route components import from
  `src/shared/`, never from each other.
- `BrowserRouter` lives in `main.tsx` **only**. Never in `App.tsx`. A second
  Router instance causes a silent render failure above the boundary.
- `src/shared/data/` holds the seed data and is the single source of truth. No
  route may define its own copy of catalogue/policy data.
- All async goes through `src/shared/api.ts`. It simulates latency and supports
  both `AbortSignal` (for the `useEffect` path) and promise caching (for the
  `use()` path). Both paths must exist — the contrast between them is a
  curriculum item.
- No root-level `<Suspense>` in `App.tsx`. Boundaries are placed per-route and
  per-widget on purpose, so that a missing boundary is observable.

---

## Code style

- TypeScript strict. No `any`. No `@ts-ignore`.
- Named exports for hooks and utilities; default export for route components
  (required by `React.lazy`).
- `console.log` is the sanctioned observability tool. Render-counting logs in
  memoised components are **intentional** — do not remove them, they are how the
  reviewer is shown that memoisation works. Prefix them consistently:
  `console.log('[render] PolicyRow', policy.id)`.
- Prefer explicit over clever. This code will be read aloud and defended.

---

## Deliberate defects

Some code is wrong on purpose, so the fix can be demonstrated. These live in
`src/shared/labs/` behind runtime toggles and are documented in
`docs/failure-modes.md`. Never "fix" a defect that is registered there. If you
believe a registered defect is wrong, say so — do not silently change it.

---

## What to do when blocked

Do not invent a workaround that skips a concept. If a concept genuinely cannot
be placed naturally, stop and report it rather than faking it with a contrived
component. A contrived usage is worse than an honest gap — the whole point is
that every usage survives the question _"why is this here?"_
