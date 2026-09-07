import type { StatusPalette } from './theme';

declare module '@mui/material/styles' {
  interface Palette {
    status: StatusPalette;
  }

  interface PaletteOptions {
    status: StatusPalette;
  }
}
