/**
 * WHY THIS EXISTS:
 *   The policy status badge, for MUI surfaces. It is the deliberate duplicate
 *   of `.statusActive` / `.statusPending` / `.statusLapsed` /
 *   `.statusCancelled` in `src/routes/policies/PolicyRow.module.css` — same
 *   four colours, same 2px/8px padding, same 4px corner, same 11px/600 label —
 *   built with `styled(Chip)` reading `theme.palette.status` instead of with
 *   `composes:` reading `var(--c-status-*)`.
 *
 * CONCEPTS: W4-D2-04, W4-D2-01
 *
 * WITHOUT THIS:
 *   Every MUI surface that shows a policy status either imports a CSS Module
 *   from a route folder — crossing the `src/shared/` import boundary and
 *   putting a class name from `/policies` on a component that is not on
 *   /policies — or restates the four colour pairs inline. The second is what
 *   actually happens in practice, and it is how the two halves of a
 *   mixed-styling app drift: /policies says lapsed is `#a63a12` because
 *   `global.css` says so, /dashboard says lapsed is whatever was pasted into
 *   its `sx` prop, and nothing in the build can tell you they disagree.
 *
 *   No `shouldForwardProp`: `status` is not a Chip prop, so `styled()` passes
 *   it straight through to the underlying `<div>` and the badge renders as
 *   `<div class="…" status="lapsed">`. React tolerates a lowercase unknown
 *   attribute without warning, which is what makes this one worth naming —
 *   the leak is silent, it lands in the DOM of every badge on the page, and
 *   the first thing it breaks is a `[status]` attribute selector someone
 *   later writes expecting it to mean something.
 *
 * WHY THE CSS MODULES VERSION STAYS, AND WHAT EACH COSTS:
 *   `PolicyRow.module.css` is not superseded by this file and must not be
 *   deleted. Two implementations of one badge is the point: it is the only way
 *   to state the trade honestly rather than assert it.
 *
 *   The CSS Modules version costs a second copy of the *colour source*. Its
 *   values live in `global.css` as custom properties, so a theme switch is a
 *   repaint the browser does with no JS involved and no React render at all —
 *   but nothing in JS can read `--c-status-lapsed`, so any chart, canvas or
 *   inline style that needs the same colour has to be told it again.
 *
 *   The `styled()` version costs a second copy of the *values themselves*
 *   (see the duplication note in `theme.ts`) and a runtime: Emotion serialises
 *   the style object, hashes it and injects a class on first render, and the
 *   theme object has to reach the component through React context — so a
 *   badge outside `ThemeProvider` throws rather than rendering unstyled. What
 *   it buys is that the colour is a typed value in JS, reachable by anything
 *   that can read the theme, and keyed by `PolicyStatus` so an unknown status
 *   is a compile error rather than a missing class.
 *
 * WHY styled() HERE AND `sx` ON THE DASHBOARD, NOT THE REVERSE:
 *   This is a reusable component with a variant axis, so it is a `styled()`
 *   component. `sx` would be the wrong tool for it in three concrete ways.
 *
 *   First, `sx` cannot be reused without a component to hang it on: sharing it
 *   means exporting a plain style object and spreading it at every call site,
 *   which is a component with none of the guarantees of one — no props, no
 *   `shouldForwardProp`, nothing stopping a call site from spreading it and
 *   then overriding the colour it exists to enforce.
 *
 *   Second, `sx` is resolved on every render of its owner and produces a fresh
 *   object literal each time, so it cannot be cached across instances. In a
 *   140-row policy table that is 140 style serialisations per render;
 *   `styled()` serialises once per distinct `status` value — four times, ever
 *   — and every chip after that reuses the injected class.
 *
 *   Third, `sx` carries no type relationship to `PolicyStatus`. Inside
 *   `styled()`, the `status` prop is part of the component's signature, so
 *   `<StatusChip status="expired" />` fails to compile. Written as `sx`, the
 *   same mistake is a lookup that returns `undefined` and paints nothing.
 *
 *   The reverse assignment fails just as concretely: the dashboard's spacing
 *   is used once, in one place, with no variant axis. Promoting it to a
 *   `styled()` component means a named export, an import, and a level of
 *   indirection between reading `<Box>` and knowing what it looks like — for
 *   a `mt` and a `gap` that will never be reused. The rule this file and
 *   `DashboardPage` are demonstrating together: `styled()` when it is reused
 *   or has variants, `sx` when it is one-off and local.
 */

import Chip, { type ChipProps } from '@mui/material/Chip';
import { styled } from '@mui/material/styles';
import { POLICY_STATUS_LABEL } from '../format';
import type { PolicyStatus } from '../types';

/*
 * `shouldForwardProp` is what keeps `status` in the style callback and out of
 * the DOM — see the header. The generic parameter is what makes `status`
 * visible to that callback in the first place; without it, `styled(Chip)`
 * knows only about `ChipProps` and `theme.palette.status[status]` has nothing
 * to index with.
 */
const StatusChipRoot = styled(Chip, {
  shouldForwardProp: (prop) => prop !== 'status',
})<{ status: PolicyStatus }>(({ theme, status }) => ({
  /*
   * Chip ships as a 32px pill. The badge it is impersonating is a 2px-padded
   * inline block on a 4px corner, so height, padding and radius are all
   * overridden — and the label slot has its own 12px horizontal padding that
   * survives anything set on the root, which is why `.MuiChip-label` is
   * addressed directly. Styling only the root leaves the chip 24px wider than
   * the CSS Modules badge, which is the visible tell that a "same badge"
   * claim has not actually been checked side by side.
   */
  height: 'auto',
  padding: `2px ${theme.spacing(1)}`,
  borderRadius: theme.shape.borderRadius,
  fontSize: '11px',
  fontWeight: 600,
  lineHeight: 1.45,
  backgroundColor: theme.palette.status[status].soft,
  color: theme.palette.status[status].main,
  '& .MuiChip-label': { padding: 0 },
}));

export interface StatusChipProps extends Omit<ChipProps, 'color' | 'label'> {
  status: PolicyStatus;
}

/**
 * The label comes from `POLICY_STATUS_LABEL`, the same map `PolicyRow` reads.
 * Letting call sites pass their own label is how "Lapsed" on one surface
 * becomes "Lapsed policy" on another; `label` is therefore omitted from the
 * public props rather than merely defaulted.
 */
export function StatusChip({ status, ...rest }: StatusChipProps) {
  return <StatusChipRoot {...rest} status={status} label={POLICY_STATUS_LABEL[status]} />;
}
