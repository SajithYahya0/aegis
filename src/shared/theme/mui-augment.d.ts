/**
 * WHY THIS EXISTS:
 *   MUI's `Palette` is a closed interface. This file re-opens it so the custom
 *   `status` key that `createAegisTheme` puts on every theme is a *declared*
 *   part of the palette type, readable as `theme.palette.status.lapsed.soft`
 *   with real completion and real checking.
 *
 * CONCEPTS: W4-D2-01
 *
 * WITHOUT THIS:
 *   Two failures, one at each end of the same key.
 *
 *   At the write end, `createTheme({ palette: { status: … } })` does not
 *   compile: `PaletteOptions` has no `status` member, so TypeScript rejects
 *   the literal as an excess property. The usual workaround is a cast —
 *   `palette: { …, status } as PaletteOptions` — which is exactly the
 *   `any`-shaped escape hatch this file exists to make unnecessary.
 *
 *   At the read end, `styled()`'s callback receives the augmented `Theme`, so
 *   without the augmentation `theme.palette.status` is a compile error inside
 *   `StatusChip` and every other consumer. Silencing that with
 *   `(theme.palette as any).status[status].soft` gives up the one guarantee
 *   worth having here — that `status` is keyed by `PolicyStatus` and nothing
 *   else. A typo'd `theme.palette.status.expired` would then survive `tsc`,
 *   reach the browser, and render a chip with `backgroundColor: undefined`: a
 *   transparent badge, on the one component whose entire job is colour.
 *
 *   Both interfaces are widened, not just `Palette`. `Palette` is what the
 *   finished theme has; `PaletteOptions` is what `createTheme` accepts.
 *   Augmenting one of them fixes exactly one of the two failures above.
 *   `status` is declared required on `PaletteOptions` rather than optional on
 *   purpose: optional would let some other `createTheme` call elsewhere in the
 *   app produce a theme with no status colours at all, and `StatusChip` would
 *   then crash on `undefined[status]` at runtime instead of failing to
 *   compile.
 *
 *   WHY THIS IS NOT CALLED `theme.d.ts`: it was, briefly, and it was not
 *   compiled at all — silently. A `.d.ts` sitting beside a `.ts` of the same
 *   basename is dropped by TypeScript's *wildcard* file matcher: `include`
 *   keeps only the highest-priority extension per basename (.ts over .tsx over
 *   .d.ts), on the assumption that `theme.d.ts` is `theme.ts`'s emitted
 *   declaration output rather than a source file of its own. The symptom was
 *   the three errors this file exists to prevent, all reported in *other*
 *   files (`theme.ts`, `StatusChip.tsx`), with this one looking perfectly
 *   correct and absent from `tsc --noEmit --listFiles`.
 *
 *   There are two fixes and this repo takes the second. An explicit `files`
 *   entry in `tsconfig.json` is exempt from that filtering and does work — but
 *   it leaves a hand-maintained list that has to be remembered by anyone who
 *   later moves or splits this file, to keep a rule about *filenames* working.
 *   A basename that does not collide needs no list and cannot fall out of sync
 *   with one, and `mui-augment` says what the file does rather than which
 *   module it happens to sit next to. The collision rule is worth knowing
 *   either way, which is why it is written down here rather than fixed
 *   silently by a rename.
 *
 *   The `import` above the `declare module` is also load-bearing, and its
 *   absence is the classic silent version of this bug: a `.d.ts` with no
 *   top-level import or export is a *script*, not a module, and
 *   `declare module '@mui/material/styles'` inside a script is an ambient
 *   module *declaration* — it replaces MUI's own types for that specifier
 *   rather than merging with them. The symptom is not an error here; it is
 *   `createTheme` and every other export of `@mui/material/styles` suddenly
 *   resolving to `any` across the whole app.
 */

import type { StatusPalette } from './theme';

declare module '@mui/material/styles' {
  interface Palette {
    status: StatusPalette;
  }

  interface PaletteOptions {
    status: StatusPalette;
  }
}
