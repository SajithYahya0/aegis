import { render, screen, cleanup } from '@testing-library/react';
import { act } from 'react';
import { useTheme } from '@mui/material/styles';
import { beforeEach, describe, expect, it } from 'vitest';
import { StatusChip } from './StatusChip';
import { ThemeModeProvider, useThemeChoice, type ThemeChoice } from './ThemeModeProvider';

/**
 * Reads the theme through the same context MUI components use, so a broken
 * `status` key fails here for the same reason it would fail in a real badge.
 */
function ThemeProbe(): React.ReactElement {
  const { choice, setChoice } = useThemeChoice();
  const theme = useTheme();

  return (
    <div>
      <span data-testid="choice">{choice}</span>
      <span data-testid="mode">{theme.palette.mode}</span>
      <span data-testid="active-ink">{theme.palette.status.active.main}</span>
      <span data-testid="active-ground">{theme.palette.status.active.soft}</span>
      <span data-testid="body-bg">{theme.palette.background.default}</span>
      <StatusChip status="lapsed" />
      {(['light', 'dark', 'system'] as ThemeChoice[]).map((option) => (
        <button key={option} type="button" onClick={() => setChoice(option)}>
          {option}
        </button>
      ))}
    </div>
  );
}

function mount(): void {
  render(
    <ThemeModeProvider>
      <ThemeProbe />
    </ThemeModeProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe('ThemeModeProvider', () => {
  it('starts on the system choice and resolves it to a concrete mode', () => {
    mount();

    // The matchMedia shim in setupTests reports "not dark".
    expect(screen.getByTestId('choice')).toHaveTextContent('system');
    expect(screen.getByTestId('mode')).toHaveTextContent('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('survives a reload once dark is chosen', () => {
    mount();

    act(() => {
      screen.getByRole('button', { name: 'dark' }).click();
    });

    expect(screen.getByTestId('mode')).toHaveTextContent('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    // JSON, not a bare string — `useLocalStorage` stores the parsed value, and
    // `index.html`'s pre-paint bootstrap parses it back the same way.
    expect(localStorage.getItem('aegis.theme')).toBe('"dark"');

    /*
     * The reload. Everything React held is gone; only localStorage crosses
     * the boundary. A provider that kept the choice in `useState` alone would
     * come back up on 'system' here and this assertion would catch it.
     */
    cleanup();
    delete document.documentElement.dataset.theme;
    mount();

    expect(screen.getByTestId('choice')).toHaveTextContent('dark');
    expect(screen.getByTestId('mode')).toHaveTextContent('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('swaps the custom status palette and the body ground with the mode', () => {
    mount();

    // Light — the values in `global.css`'s `:root` block.
    expect(screen.getByTestId('active-ink')).toHaveTextContent('#1a7f4b');
    expect(screen.getByTestId('active-ground')).toHaveTextContent('#e3f4ea');
    expect(screen.getByTestId('body-bg')).toHaveTextContent('#f4f5f7');

    act(() => {
      screen.getByRole('button', { name: 'dark' }).click();
    });

    // Dark — the values in the `[data-theme='dark']` block. Same hues, and
    // deliberately not the light ramp inverted.
    expect(screen.getByTestId('active-ink')).toHaveTextContent('#46c47f');
    expect(screen.getByTestId('active-ground')).toHaveTextContent('#13291d');
    expect(screen.getByTestId('body-bg')).toHaveTextContent('#12151a');
  });

  it('renders a StatusChip whose label comes from the shared status map', () => {
    mount();

    /*
     * `StatusChip` takes a `PolicyStatus`, never a label, so this is also the
     * check that it did not quietly grow a `label` passthrough — that is how
     * "Lapsed" on one surface becomes "Lapsed policy" on the next.
     */
    expect(screen.getByText('Lapsed')).toBeInTheDocument();
  });

  it('does not leak the status prop onto the DOM', () => {
    mount();

    /*
     * The `shouldForwardProp` guard. React does not warn about an unknown
     * lowercase attribute, so without an assertion this regresses silently and
     * every badge in the app ships `status="lapsed"` in its markup.
     */
    expect(screen.getByText('Lapsed').closest('[status]')).toBeNull();
  });
});
