import React, { createContext, useContext, useMemo } from 'react';
import { getTheme, getInkTheme } from './theme.js';
import type { ThemeColors, ThemeInkColors } from './theme.js';
import type { ThemeName } from '../config/schema.js';

export interface ThemeContextValue {
  colors: ThemeColors;
  ink: ThemeInkColors;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  theme: ThemeName;
  children: React.ReactNode;
}

export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  const value = useMemo(() => ({
    colors: getTheme(theme),
    ink: getInkTheme(theme),
  }), [theme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Access the current theme colors and ink color names.
 * Falls back to the default theme if used outside a ThemeProvider.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx) return ctx;
  // Fallback to default theme
  return { colors: getTheme('default'), ink: getInkTheme('default') };
}
