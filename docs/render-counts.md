# AEGIS — Render Counts (C-12)

Real numbers, captured from the console, not estimated. `docs/coverage-matrix.md`
asks for measured before/after render counts for the memo and deferred-value
work — this is that measurement.

## How these were captured

A temporary test file rendered the real `App` at `/policies` inside
`MemoryRouter` (via `@testing-library/react`), typed a sequence of characters
into the search box with `fireEvent.change`, and let `npx vitest run` print
whatever the app's own `console.log` calls print — the exact same
`[render] PolicyRow`, `[render] PremiumBadge`, `[render] FilterStatus` and
`[rating] rateBook …` lines that show up in a real browser's console. The
probe file was deleted immediately after these numbers were recorded; nothing
about the app's own logging changed to produce them. To reproduce, add a test
that mounts `<App>` at `/policies`, `fireEvent.change` the input with
`placeholder="Search policy id or customer name"`, and read the console.

No `StrictMode` in this measurement: `App.test.tsx` (and this probe) render
`<App>` directly, and `StrictMode` lives only in `main.tsx`. In a real
browser during development, every count below doubles — `main.tsx`'s header
explains why that doubling is deliberate (it is what proves every effect
cleanup actually works) and why it doesn't change which comparisons matter:
both the memoised and un-memoised sides of every contrast below double
equally, so the *ratio* — the thing being demonstrated — is unaffected.

## The book

140 policies, 1 table, 6 columns. `PolicyRow` (`React.memo`) and
`PremiumBadge` (`React.memo` with a custom comparator) are the components
under test; `FilterStatus` (deliberately un-memoised, W3-D1-06) is the
contrast baseline; `rateBook`'s `useMemo` (W3-D1-03) is measured separately.

### Sequence

1. Mount `/policies`.
2. Type `"P"` in the search box (matches effectively all 140 policies — the
   filtered *set* doesn't change).
3. Type `"PO"` (still matches ~all 140).
4. Type `"POL-00001"` (narrows to exactly 1 policy).
5. Type back to `"PO"` (widens back to ~all 140).

### Measured counts

| Step | `[render] PolicyRow` | `[render] PremiumBadge` | `[render] FilterStatus` | `[rating] rateBook` |
|---|---:|---:|---:|---:|
| Initial mount | 140 | 140 | 1 | **1** (25.3ms, 140 policies) |
| Keystroke "P" (set unchanged) | **0** | **0** | 2 | 0 |
| Keystroke "PO" (set unchanged) | **0** | **0** | 2 | 0 |
| Narrow to "POL-00001" (140→1) | **0** | **0** | 2 | 0 |
| Widen back to "PO" (1→140) | 139 | 139 | 0 | 0 |
| **Whole sequence** | **279** | **279** | **8** | **1 total** |

Raw log excerpt (initial `rateBook` line, unedited):

```
[rating] rateBook 140 policies in 25.3ms
```

### Reading the table

**`PolicyRow`/`PremiumBadge` — the memo, working.** Two keystrokes that
leave the filtered set unchanged produce **zero** row re-renders, out of 140
mounted rows, each time. That's `React.memo` bailing out on unchanged props —
not "fewer renders than before", *no* renders, because `policy`, `premium`
and `onSelect` are all referentially identical to what each row already had.
`PremiumBadge`'s custom comparator doesn't diverge from `PolicyRow`'s default
one in this run, because `rateBook` is deterministic and computed exactly
once for the whole session — there's no second, paisa-perturbed pricing pass
for the comparator to catch that plain equality would have missed. That
specific case is real (see the header of `PremiumBadge.tsx`) but isn't
independently measurable without contriving a second `rateBook` run, which
the app never actually does.

**Narrowing costs nothing extra; widening costs exactly what it must.**
Narrowing 140→1 policies produces **zero** `PolicyRow` logs: the 139 rows
that leave the visible set simply unmount — unmounting doesn't execute the
component function, so there's nothing to log — and the one row that stays
doesn't re-render, because its own props didn't change. Widening 1→140 the
other way produces **139** logs, not 140: that's 139 fresh *mounts* (a
component always runs on mount, regardless of memo — memo only skips
re-renders of an already-mounted instance) plus the one row that was already
there, which still doesn't re-log. Memoisation was never going to make new
rows free; the measurement shows it isn't charging anything beyond that
unavoidable cost either.

**`FilterStatus` — the contrast.** Every keystroke that changes `rawQuery`
re-renders `FilterStatus` **twice** — once for the urgent update (`isStale`
flips to `true`, "Updating…"), once when the deferred value settles
(`isStale` flips back, the count is current) — regardless of whether the
*filtered set* actually changed. This is what "no memo" costs: a component
that receives new props on every parent re-render pays for every one of
them, whether or not its own displayed content would differ. W3-D1-06's
argument is that memoising `FilterStatus` wouldn't avoid this — its props
(`resultCount`, `isStale`) really do change on every one of those renders, so
a comparator here would run twice per keystroke, report "changed" both
times, and re-render anyway: strictly more work than skipping the memo.

**`rateBook` — the `useMemo`, working.** Across the entire five-step
sequence — three keystrokes, one narrow, one widen — `rateBook` runs
**exactly once**, at mount. `PoliciesPage` prices the *whole* book and keys
the memo on the book itself (`policies`/`customers`/`claims`, module-level
singletons that never change), not on `filtered` — see `PoliciesPage.tsx`'s
header for the real bug that shipped when an earlier version keyed it on
`filtered` instead. Without the memo, that same sequence would show five
separate `[rating] rateBook …` lines, each costing on the order of the
measured 25.3ms — over 100ms of avoidable main-thread work across five
keystrokes that a real user would type in under two seconds, which is also
what makes `useDeferredValue` (C-03) worth having on the same input: without
it, that re-pricing work runs synchronously inside the render that echoes
the keystroke that triggered it.

## What "predicted, not measured" would look like

For completeness, the counterfactual — `PolicyRow` *without* `React.memo` —
was not built (that would mean shipping a second, deliberately worse
component nothing in the app uses, the kind of contrived addition CLAUDE.md
rules out). It doesn't need to be: `FilterStatus`'s measured behaviour above
*is* that counterfactual, running live in the same app. An un-memoised
`PolicyRow` would re-render on every parent re-render the same way
`FilterStatus` does — twice per keystroke — which for 140 rows predicts
**280** additional, avoidable renders per keystroke that changes `rawQuery`,
none of which the measured run above shows.
