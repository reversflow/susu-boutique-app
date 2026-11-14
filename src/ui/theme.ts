export type ThemeMode = 'light' | 'dark';

const spacing = {
  xs: 4,
  sm: 8,
  compact: 12,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

const radius = {
  sm: 6,
  md: 10,
  lg: 14,
} as const;

const typography = {
  serifFamily: 'serif',
  pageHeading: 34,
  primaryTotal: 36,
  sectionHeading: 20,
  body: 16,
  supporting: 13,
} as const;

type AppTypography = Omit<typeof typography, 'serifFamily'> & { serifFamily: string };

const lightColors = {
  background: '#F3F4EF',
  surface: '#FFFFFF',
  card: '#E6EDE6',
  primary: '#285744',
  primarySoft: '#446E5B',
  onPrimary: '#FFFFFF',
  text: '#233B32',
  mutedText: '#596B62',
  border: '#D9E1D9',
  success: '#35633F',
  danger: '#A13832',
  sales: '#2F638D',
  investment: '#865D22',
  white: '#FFFFFF',
  black: '#111111',
  inputBackground: '#FFFFFF',
  drawerOverlay: 'rgba(56,46,36,0.2)',
  calendarBackground: '#FAF5EB',
  calendarSurface: '#FFFCF6',
  calendarText: '#382E24',
  calendarMutedText: '#77624F',
  calendarBorder: '#E2D6C3',
  calendarHighlight: 'rgba(133,73,47,0.18)',
  calendarLoadingOverlay: 'rgba(250,245,235,0.9)',
} as const;

const darkColors = {
  background: '#19221E',
  surface: '#24312B',
  card: '#35463B',
  primary: '#B9DCC1',
  primarySoft: '#95C4A1',
  onPrimary: '#183323',
  text: '#F0F5EF',
  mutedText: '#BBCAC0',
  border: '#46594D',
  success: '#A7C7A2',
  danger: '#E39B91',
  sales: '#A3CCEF',
  investment: '#E7C085',
  white: '#FFFFFF',
  black: '#111111',
  inputBackground: '#24312B',
  drawerOverlay: 'rgba(0,0,0,0.45)',
  calendarBackground: '#27231C',
  calendarSurface: '#302B23',
  calendarText: '#F5ECDC',
  calendarMutedText: '#C7B69E',
  calendarBorder: '#4E4436',
  calendarHighlight: 'rgba(233,184,150,0.2)',
  calendarLoadingOverlay: 'rgba(39,35,28,0.9)',
} as const;

export type ThemeColorKey = keyof typeof lightColors;
export type ThemeColors = Record<ThemeColorKey, string>;

export type AppTheme = {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: AppTypography;
};

export function normalizeThemePreference(value: string | null | undefined): ThemeMode {
  return value === 'dark' ? 'dark' : 'light';
}

export function resolveTheme(mode: ThemeMode, serifFamily: string = typography.serifFamily): AppTheme {
  const colors = mode === 'dark' ? darkColors : lightColors;

  return {
    mode,
    isDark: mode === 'dark',
    colors,
    spacing,
    radius,
    typography: { ...typography, serifFamily },
  };
}

export const Theme = resolveTheme('light');
