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
import { ThemeProvider, createTheme, type PaletteMode, type Theme } from '@mui/material/styles';
import { useLocalStorage } from './hooks';

export type ThemeChoice = 'light' | 'dark' | 'system';

export const NEXT_THEME_CHOICE: Record<ThemeChoice, ThemeChoice> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

const THEME_KEY = 'aegis.theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';
const FONT_SANS =
  "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export function createAegisTheme(mode: PaletteMode): Theme {
  const dark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: dark ? '#6aa5f0' : '#1f4f8f',
        light: dark ? '#1b2c44' : '#e7eefa',
        dark: dark ? '#8dbcf7' : '#1a4177',
      },
      background: {
        default: dark ? '#12151a' : '#f4f5f7',
        paper: dark ? '#1a1e25' : '#ffffff',
      },
      text: {
        primary: dark ? '#e6e9ee' : '#16191d',
        secondary: dark ? '#a3acba' : '#5b626d',
      },
      divider: dark ? '#2f3640' : '#d8dce2',
    },
    typography: {
      fontFamily: FONT_SANS,
      h1: { fontSize: '24px', fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.25 },
      h2: { fontSize: '18px', fontWeight: 600, lineHeight: 1.3 },
      body1: { fontSize: '13px', lineHeight: 1.45 },
      body2: { fontSize: '12px', lineHeight: 1.45 },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    shape: { borderRadius: 6 },
    components: {
      MuiButton: { defaultProps: { disableElevation: true } },
      MuiCard: { defaultProps: { variant: 'outlined' } },
      MuiTextField: { defaultProps: { size: 'small' } },
    },
  });
}

interface ThemeChoiceValue {
  choice: ThemeChoice;
  setChoice: Dispatch<SetStateAction<ThemeChoice>>;
}

const ThemeChoiceContext = createContext<ThemeChoiceValue | null>(null);

export function useThemeChoice(): ThemeChoiceValue {
  const value = useContext(ThemeChoiceContext);
  if (!value) throw new Error('useThemeChoice must be used inside <ThemeModeProvider>.');
  return value;
}

export function ThemeModeProvider({ children }: { children: ReactNode }): ReactElement {
  const [choice, setChoice] = useLocalStorage<ThemeChoice>(THEME_KEY, 'system');
  const [systemDark, setSystemDark] = useState(() => window.matchMedia(DARK_QUERY).matches);

  useEffect(() => {
    if (choice !== 'system') return;
    const query = window.matchMedia(DARK_QUERY);
    setSystemDark(query.matches);
    const onChange = (event: MediaQueryListEvent): void => setSystemDark(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [choice]);

  const mode = choice === 'system' ? (systemDark ? 'dark' : 'light') : choice;
  const theme = useMemo(() => createAegisTheme(mode), [mode]);
  const value = useMemo(() => ({ choice, setChoice }), [choice, setChoice]);

  return (
    <ThemeChoiceContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline enableColorScheme />
        {children}
      </ThemeProvider>
    </ThemeChoiceContext.Provider>
  );
}
