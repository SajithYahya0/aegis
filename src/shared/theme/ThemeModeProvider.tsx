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
