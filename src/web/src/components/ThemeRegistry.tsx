'use client';

import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import CssBaseline from '@mui/material/CssBaseline';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import type { ReactNode } from 'react';

const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'class' },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: '#2454d6' },
        secondary: { main: '#7c3aed' },
        background: { default: '#f6f8fc', paper: '#ffffff' },
      },
    },
    dark: {
      palette: {
        primary: { main: '#93b4ff' },
        secondary: { main: '#c4b5fd' },
        background: { default: '#0f172a', paper: '#111827' },
      },
    },
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: { fontWeight: 800 },
    h2: { fontWeight: 800 },
    h3: { fontWeight: 750 },
    h4: { fontWeight: 750 },
    button: { textTransform: 'none', fontWeight: 700 },
  },
  components: {
    MuiCard: { styleOverrides: { root: { boxShadow: '0 18px 55px rgba(15, 23, 42, 0.08)' } } },
    MuiButtonBase: { defaultProps: { disableRipple: false } },
  },
});

export function ThemeRegistry({ children }: { children: ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ enableCssLayer: true }}>
      <ThemeProvider theme={theme} defaultMode="system" modeStorageKey="jev-studio-color-mode">
        <CssBaseline enableColorScheme />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
