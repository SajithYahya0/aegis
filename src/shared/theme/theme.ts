/**
 * WHY THIS EXISTS:
 *   The single factory that turns a palette mode into the MUI theme every
 *   Week 4 surface renders against. It is the theme-object counterpart of
 *   `src/styles/global.css`: the same neutral ramp, the same accent, the same
 *   four status colours, expressed as a JS object because MUI components read
 *   colour from `theme`, not from CSS custom properties.
 *
 * CONCEPTS: W4-D2-01, W4-D2-02
 *
 * WITHOUT THIS:
 *   No factory, only a module-level `createTheme(...)` constant: the app can
 *   ship exactly one palette. Dark mode then has to be done the way the CSS
 *   Modules half does it — a second block of tokens keyed off an attribute —
 *   except MUI's `sx`, `styled()` and every built-in component resolve colour
 *   at *render* time from the theme object, not at paint time from the
 *   cascade. A `[data-theme='dark']` block cannot reach inside
 *   `theme.palette.background.paper`, so the CSS Modules routes would flip to
 *   dark and every MUI surface would stay white.
 *
 *   No `background.default`: `<CssBaseline />` paints `body` with MUI's own
 *   default (`#fff` / `#121212`), so switching to dark repaints the body a
 *   grey the rest of the app does not use, and the MUI surfaces sit on a
 *   different ground from the CSS Modules ones by two or three steps of
 *   lightness. The values below are `--c-bg` exactly, so the seam between a
 *   MUI route and a CSS Modules route is invisible — which is the whole
 *   premise of keeping both.
 *
 *   No custom `status` key: each MUI surface that needs a status colour reads
 *   it from somewhere else — a local constant, an imported hex, a
 *   `PolicyStatus`-to-`Chip` `color` map borrowing MUI's `success`/`warning`
 *   slots. That is the failure `global.css`'s own header calls out one layer
 *   down ("the moment two modules disagree about what `--status-lapsed`
 *   means, the same status renders amber on the list and red on the detail
 *   page"), reintroduced across the CSS/JS boundary instead of across two
 *   stylesheets.
 *
 *   No `typography`/`spacing`/`components` block: house style is declared at
 *   every call site instead of once. The concrete version of that is the
 *   button — MUI ships `textTransform: 'uppercase'`, this app is sentence
 *   case everywhere else, so without the override every MUI surface needs its
 *   own `sx={{ textTransform: 'none' }}` and the first one anybody forgets is
 *   a SHOUTING button sitting next to a sentence-case one.
 */

import { createTheme, type PaletteMode, type Theme } from '@mui/material/styles';
import type { PolicyStatus } from '../types';

/**
 * Two values per status, because the badge needs both and neither is
 * derivable from the other: `main` is the ink, `soft` is the wash behind it,
 * and each pair was picked for contrast against the *other* member of the
 * pair. One hex plus an `alpha()` call would look right in light mode and
 * fail in dark, where the soft ends are dark tints rather than pale washes.
 *
 * Exported because `mui-augment.d.ts` augments MUI's `Palette` with this exact
 * type — the augmentation is what makes `theme.palette.status` typed rather
 * than `any`, and it has to name the same shape the factory below builds.
 */
export interface StatusColor {
  /** The text/ink colour. Mirrors `--c-status-<name>` in `global.css`. */
  main: string;
  /** The badge ground. Mirrors `--c-status-<name>-soft` in `global.css`. */
  soft: string;
}

export type StatusPalette = Record<PolicyStatus, StatusColor>;

/*
 * The hexes below are copied from `src/styles/global.css`, and that copy is a
 * known cost, not an oversight. CSS custom properties are resolved by the
 * cascade against an element at paint time; `theme.palette.status.lapsed.main`
 * is read by JS at render time, and there is no supported way for
 * `createTheme` to read a `var(--c-status-lapsed)` that has not been computed
 * yet. The alternative — setting every MUI colour to the literal string
 * `'var(--c-status-lapsed)'` — does paint correctly, but it makes every colour
 * in the theme opaque to MUI's own machinery: `alpha()`, `lighten()` and
 * `getContrastText()` all receive a string they cannot parse and either throw
 * or return something meaningless.
 *
 * So: two copies, one authority. `global.css` is the authority — it is the one
 * the Week 1-3 surfaces read — and a change there has to be mirrored here.
 * That is the standing price of a mixed-styling app, and it is the same price
 * `StatusChip` pays for existing alongside `PolicyRow.module.css`.
 */
const STATUS_LIGHT: StatusPalette = {
  active: { main: '#1a7f4b', soft: '#e3f4ea' },
  pending: { main: '#8a6100', soft: '#fdf3dd' },
  lapsed: { main: '#a63a12', soft: '#fdeae2' },
  cancelled: { main: '#5b626d', soft: '#eceef1' },
};

const STATUS_DARK: StatusPalette = {
  active: { main: '#46c47f', soft: '#13291d' },
  pending: { main: '#e0a83a', soft: '#302510' },
  lapsed: { main: '#f0855c', soft: '#34190f' },
  cancelled: { main: '#a3acba', soft: '#262b33' },
};

const FONT_SANS =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/**
 * Builds the theme for one palette mode.
 *
 * Called from `ThemeModeProvider`, memoised on `mode`. `createTheme` walks and
 * freezes a large object; calling it unmemoised in a provider that sits above
 * the entire router would hand `ThemeProvider` a new theme *identity* on every
 * render, which invalidates the cached styles of every `styled()` component
 * below it and re-renders every `sx` consumer in the tree.
 */
export function createAegisTheme(mode: PaletteMode): Theme {
  const dark = mode === 'dark';

  return createTheme({
    palette: {
      /*
       * `mode` is not bookkeeping: it is what MUI's own components branch on
       * for the dozens of colours this file does not name — hover overlays,
       * disabled text, the Paper elevation tints, the ripple. Setting dark
       * hexes while leaving `mode: 'light'` gives a dark app with light-mode
       * overlays: white ripples blooming on a near-black button.
       */
      mode,

      /* `--c-accent` / `--c-accent-hover` / `--c-accent-soft`. */
      primary: {
        main: dark ? '#6aa5f0' : '#1f4f8f',
        dark: dark ? '#8dbcf7' : '#1a4177',
        light: dark ? '#1b2c44' : '#e7eefa',
        contrastText: dark ? '#12151a' : '#ffffff',
      },

      /*
       * The console has no second brand colour, and inventing one would put a
       * hex in this file that appears nowhere in `global.css` — the exact
       * drift the status block above exists to prevent. Secondary is
       * therefore the neutral ramp's strong end (`--c-text-muted`), which is
       * already what the app uses for its lower-emphasis affordances.
       */
      secondary: {
        main: dark ? '#a3acba' : '#5b626d',
        contrastText: dark ? '#12151a' : '#ffffff',
      },

      error: { main: dark ? '#f4776d' : '#b3261e' },

      background: {
        default: dark ? '#12151a' : '#f4f5f7',
        paper: dark ? '#1a1e25' : '#ffffff',
      },

      text: {
        primary: dark ? '#e6e9ee' : '#16191d',
        secondary: dark ? '#a3acba' : '#5b626d',
        disabled: dark ? '#868f9d' : '#868d98',
      },

      divider: dark ? '#2f3640' : '#d8dce2',

      /* The custom key. Typed by the augmentation in `mui-augment.d.ts`. */
      status: dark ? STATUS_DARK : STATUS_LIGHT,
    },

    typography: {
      fontFamily: FONT_SANS,

      /*
       * MUI's h1 is 96px and its h2 is 60px — display sizes for a marketing
       * page. This is a dense back-office console whose page titles are 24px
       * (`--fs-2xl`) and whose section titles are 19px (`--fs-xl`). Left at
       * the defaults, one `<Typography variant="h1">` on /dashboard would be
       * four times the size of the plain `<h1>` on /policies, and the two
       * routes would stop looking like the same product.
       */
      h1: { fontSize: '24px', fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.25 },
      h2: { fontSize: '19px', fontWeight: 600, letterSpacing: '-0.005em', lineHeight: 1.3 },

      /*
       * `--fs-md` and `--fs-sm`. body1 is here for a reason beyond house
       * style: `CssBaseline` spreads `typography.body1` onto `body`, and its
       * injected stylesheet lands after `global.css` in both dev and prod
       * (Emotion appends to `<head>` at first render; the global sheet is
       * already there). So MUI's default body1 — 1rem, i.e. 16px — silently
       * becomes the base font size for the *whole* app, CSS Modules routes
       * included, and every piece of text that inherits rather than setting
       * `var(--fs-*)` grows by three pixels. Matching `--fs-md` here means the
       * two stylesheets agree and the winner stops mattering.
       */
      body1: { fontSize: '13px', lineHeight: 1.45 },
      body2: { fontSize: '12px', lineHeight: 1.45 },

      /* House style, declared once. See this file's header. */
      button: { textTransform: 'none', fontWeight: 600 },
    },

    /*
     * 8px, stated rather than inherited. MUI's default happens to be 8 as
     * well, so this line moves no pixel — it is here because `sx={{ p: 2 }}`
     * meaning 16px is load-bearing at every `sx` call site, and a number that
     * important should be readable in the theme rather than remembered as a
     * framework default. `--s-2` in `global.css` is the same 8px, so `p: 2`
     * and `var(--s-4)` agree across the styling boundary.
     */
    spacing: 8,

    /* `--radius`. */
    shape: { borderRadius: 4 },

    components: {
      /*
       * defaultProps changes the component's default *behaviour*, and a call
       * site can still override it. MUI's contained Button ships a drop
       * shadow that lifts it off the page; nothing else in this console has
       * one (`--shadow-panel` is a 1px hairline). Without this, every
       * contained button is the most elevated object on screen.
       */
      MuiButton: {
        defaultProps: { disableElevation: true },
      },

      /*
       * styleOverrides changes the component's *styles*, merged into the
       * named slot. Cards get `--radius-lg` (6px) rather than the theme's
       * base 4px, matching `.panel` in `Panel.module.css`, so a Card on
       * /dashboard and a Panel on /policies have the same corner.
       *
       * Note which lever does which job. `disableElevation` is a prop the
       * component already understands, so it belongs in `defaultProps`, where
       * a call site can still pass `disableElevation={false}`. A corner radius
       * is not a Card prop at all, so it is only reachable through
       * `styleOverrides`. Swapping them means either writing a style override
       * for something a prop already expresses — and that no call site can now
       * opt out of — or reaching for a prop that does not exist.
       */
      MuiCard: {
        styleOverrides: {
          root: { borderRadius: 6 },
        },
      },
    },
  });
}
