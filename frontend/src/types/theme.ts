export type ThemeMode = 'light' | 'dark';

export interface ThemeTokens {
  font: {
    heading: string;
    body: string;
    mono: string;
  };
  color: {
    bgPrimary: string;
    bgSecondary: string;
    bgTertiary: string;
    bgElevated: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    primary: string;
    primaryHover: string;
    primaryLight: string;
    success: string;
    warning: string;
    error: string;
    info: string;
    border: string;
    borderHover: string;
  };
}

export interface ChartPalette {
  qualitative: readonly string[];
  severity: {
    success: string;
    warning: string;
    error: string;
    info: string;
  };
}

export const chartPalette: ChartPalette = {
  qualitative: [
    '#2563EB',
    '#0EA5E9',
    '#14B8A6',
    '#22C55E',
    '#F59E0B',
    '#F97316',
    '#A855F7',
    '#EC4899',
  ],
  severity: {
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    error: 'var(--color-error)',
    info: 'var(--color-info)',
  },
};
