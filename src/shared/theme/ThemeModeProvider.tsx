/**
 * WHY THIS EXISTS:
 *   One owner for "which theme is on". It holds the persisted choice, resolves
 *   `'system'` against the OS, writes `data-theme` for the CSS Modules half of
 *   the app, and builds the MUI theme for the other half — so both halves flip
 *   from a single piece of state, and mounts `ThemeProvider` + `CssBaseline`
 *   above the router.
 *
 * CONCEPTS: W4-D1-01, W4-D2-03, W4-D2-01
 *
 * WITHOUT THIS:
 *   Two sources of truth for one visible fact. The choice used to live in
 *   `AppLayout`, which is *below* the router; MUI's `ThemeProvider` has to sit
 *   above it (see below). A `ThemeProvider` above the router with the state
 *   below it can only be reconciled by keeping a second copy of the choice up
 *   top — and two `useLocalStorage('aegis.theme')` calls do not share state,
 *   they share a *key*. Each has its own `useState`, so setting one leaves the
 *   other on its mount-time value until a reload: the toggle would repaint
 *   /policies and leave /dashboard light, or the reverse, depending on which
 *   copy the click reached.
 *
 *   WHY ABOVE THE ROUTER: `ThemeProvider` publishes the theme through React
 *   context, and `CssBaseline` paints `body` from `theme.palette.background`.
 *   Mounted inside a route element, both stop at that route's subtree — every
 *   `styled()` component rendered outside it falls back to MUI's default
 *   theme, so a `StatusChip` in a portalled modal (`Modal` portals to
 *   `#modal-root`, outside `#root` entirely) renders with default-theme
 *   colours, and `body` keeps whatever the previous route left on it. Mounted
 *   here, above `BrowserRouter`, it also survives every navigation, so the
 *   theme object is created once per mode rather than once per route change.
 *
 *   WITHOUT THE useMemo: `createAegisTheme` runs on every render of this
 *   provider and returns a new object each time. `ThemeProvider` compares by
 *   identity, so every consumer below — every `styled()` component, every `sx`
 *   prop, every `useTheme()` — re-renders and Emotion re-serialises its
 *   styles, on a provider that wraps the entire application.
 *
 *   WITHOUT THE CONTEXT: nothing below could change the theme. This is a
 *   reversal of what `AppLayout`'s header used to argue — that a theme context
 *   would broadcast a re-render to the whole tree for a value with no
 *   consumers — and the reason it reverses is that the value now *has*
 *   consumers: MUI reads it. The broadcast objection survives only in its
 *   narrow form, and is handled: the context value is memoised on
 *   `[choice, setChoice]`, so it changes when the theme changes and at no
 *   other time. Keystrokes in the /policies search box still do not reach it,
 *   which is what the render-count logs need to stay meaningful.
 *
 *   WITHOUT THE useMemo ON THE CONTEXT VALUE — and this one is stated
 *   honestly rather than dramatised, because today it breaks nothing. This
 *   provider re-renders only when `choice` or `systemDark` moves, and both of
 *   those already change the theme, so a fresh `{ choice, setChoice }` object
 *   per render would be handed out at exactly the moments every consumer
 *   re-renders anyway. The memo is load-bearing the moment this provider owns
 *   a second piece of state that is *not* the theme — a drawer flag, a
 *   reduced-motion preference — because then every `useThemeChoice()` caller
 *   in the app, `AppShell` included, would re-render on a state change that
 *   has nothing to do with them, and the cause would be invisible from the
 *   consumer's side. It is here as the cheap guard against that, not as a fix
 *   for a bug the current shape has.
 *
 *   WITHOUT THE 'system' RESOLUTION: `data-theme` can only ever be 'light' or
 *   'dark' — CSS has no way to express "whatever the OS says" through an
 *   attribute — and `PaletteMode` has no third member either. Writing
 *   `data-theme="system"` matches no selector and falls through to the light
 *   `:root` tokens, so a dark-OS user on the default setting gets a white app.
 *
 *   WITHOUT THE matchMedia LISTENER: the OS preference is read once and never
 *   again, so a user on System whose machine flips to dark at sunset keeps the
 *   light palette until they reload, which reads as the System option being
 *   broken. The listener is removed in cleanup because it is registered on a
 *   `MediaQueryList` that outlives this component: a leaked handler goes on
 *   calling `setSystemDark` for a provider that no longer exists. StrictMode's
 *   double-mount is what makes that leak observable in dev rather than in
 *   production.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactElement,
  type ReactNode,
  type SetStateAction,
} from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { createAegisTheme } from './theme';

/*
 * What the user picks — not what gets painted. 'system' is a choice, not a
 * resolved theme: it is the third state meaning "keep following the OS", which
 * is why it has to survive a reload as itself. Persisting the resolved 'dark'
 * instead would pin the user to dark permanently the first time their OS
 * happened to be dark, and the System option would become a one-way door.
 */
export type ThemeChoice = 'light' | 'dark' | 'system';

/*
 * Shared with the pre-paint bootstrap script in `index.html`, which reads this
 * same key before React exists to avoid a white flash on a dark-mode load.
 * `useLocalStorage` stores JSON, so the value on disk is '"dark"', not 'dark'
 * — that script parses accordingly, and changing this key means changing it
 * there too.
 */
const THEME_KEY = 'aegis.theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

interface ThemeChoiceContextValue {
  choice: ThemeChoice;
  setChoice: Dispatch<SetStateAction<ThemeChoice>>;
}

const ThemeChoiceContext = createContext<ThemeChoiceContextValue | null>(null);

/**
 * Read the persisted choice and the setter. Throws outside the provider rather
 * than returning a default: a silent default here would give the theme
 * switcher a setter that updates nothing, and a control that moves without
 * changing anything is harder to diagnose than a crash on mount.
 */
export function useThemeChoice(): ThemeChoiceContextValue {
  const value = useContext(ThemeChoiceContext);

  if (!value) {
    throw new Error('useThemeChoice must be used inside <ThemeModeProvider>.');
  }

  return value;
}

export function ThemeModeProvider({ children }: { children: ReactNode }): ReactElement {
  const [choice, setChoice] = useLocalStorage<ThemeChoice>(THEME_KEY, 'system');

  /*
   * Only meaningful while `choice === 'system'`, and only initialised here so
   * that the very first render already resolves correctly — reading the OS in
   * an effect instead would render one frame of light for a dark-OS user, the
   * same flash `index.html`'s bootstrap script exists to prevent.
   */
  const [systemDark, setSystemDark] = useState<boolean>(
    () => window.matchMedia(DARK_QUERY).matches,
  );

  useEffect(() => {
    /*
     * An explicit choice needs no subscription: 'light' and 'dark' are already
     * concrete, and listening anyway would let the OS repaint an app the user
     * deliberately pinned. Re-subscribing on the way back to 'system' also
     * re-reads `query.matches`, which is what stops a stale value from the
     * pinned interval being used for a frame.
     */
    if (choice !== 'system') {
      return;
    }

    const query = window.matchMedia(DARK_QUERY);
    setSystemDark(query.matches);

    const onChange = (event: MediaQueryListEvent): void => setSystemDark(event.matches);

    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [choice]);

  const mode = choice === 'system' ? (systemDark ? 'dark' : 'light') : choice;

  useEffect(() => {
    const root = document.documentElement;

    /*
     * Hand colour back to the stylesheet. The bootstrap script in `index.html`
     * sets `color-scheme` as an inline style so the browser has a dark canvas
     * before any CSS exists; an inline style outranks a stylesheet, so leaving
     * it there would mean a user who later picks Light keeps dark scrollbars
     * and a dark native date picker for the rest of the session. React is
     * running by the time this fires, so the tokens are loaded and the
     * `[data-theme]` block can take over as the single authority on
     * `color-scheme`.
     */
    root.style.removeProperty('color-scheme');
    root.dataset.theme = mode;
  }, [mode]);

  const theme = useMemo(() => createAegisTheme(mode), [mode]);

  const choiceValue = useMemo(() => ({ choice, setChoice }), [choice, setChoice]);

  return (
    <ThemeChoiceContext.Provider value={choiceValue}>
      <ThemeProvider theme={theme}>
        {/*
          CssBaseline is what repaints `body` on a theme change: it emits a
          global rule setting `body`'s `background-color` and `color` from
          `theme.palette`, and Emotion re-injects it whenever the theme object
          changes. Its sheet is appended to `<head>` after `global.css` in both
          dev and prod, so on the MUI side of the app this rule — not the
          `body { background: var(--c-bg) }` in `global.css` — is the one that
          wins. That is exactly why `theme.ts` sets `background.default` and
          `typography.body1` to the same values `global.css` uses: the rule
          that wins has to agree with the one that loses, or the theme change
          would repaint the page a colour no CSS Modules surface uses.

          It does NOT set `color-scheme`: with a plain (non-CssVars) theme,
          `enableColorScheme` defaults to false in MUI v6. The scrollbars and
          the native date picker in the quote wizard follow the `color-scheme`
          declarations in `global.css`, keyed off the `data-theme` attribute
          written by the effect above.
        */}
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeChoiceContext.Provider>
  );
}
