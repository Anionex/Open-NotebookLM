export const designTokens = {
  colors: {
    primary: {
      50: '#faf2f4',
      100: '#f4e3e7',
      200: '#e8c7cf',
      300: '#d89ba8',
      400: '#c1697d',
      500: '#a8435a',
      600: '#8d243c',
      700: '#741d31',
      800: '#5c1829',
      900: '#3d101b',
      DEFAULT: '#8d243c',
    },
    iosGray: {
      50: '#fbfbfd',
      100: '#f2f4f7',
      200: '#e4e9f1',
      300: '#cfd7e3',
      400: '#a2adbf',
      500: '#6b7587',
      600: '#4a5466',
      700: '#344054',
      800: '#1f2937',
      900: '#101828',
    },
    accent: {
      gold: '#b6924f',
      blue: '#5c7cbe',
      mist: '#eef3fb',
    },
    semantic: {
      success: '#21a366',
      warning: '#d28a22',
      error: '#d1435b',
    },
    background: '#f6f4f2',
    paper: '#fffdfb',
    surface: '#f8fafd',
  },
  typography: {
    fonts: {
      display: '"Noto Serif SC", "Cormorant Garamond", serif',
      body: 'Inter, "SF Pro Display", "PingFang SC", "Helvetica Neue", sans-serif',
      mono: '"JetBrains Mono", "SFMono-Regular", monospace',
    },
    scale: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
    },
  },
  radius: {
    ios: '18px',
    iosLg: '24px',
    iosXl: '30px',
    ios2xl: '36px',
  },
  shadows: {
    iosSm: '0 8px 20px rgba(16, 24, 40, 0.06)',
    ios: '0 18px 48px rgba(16, 24, 40, 0.09)',
    iosLg: '0 26px 70px rgba(16, 24, 40, 0.12)',
    iosXl: '0 36px 90px rgba(16, 24, 40, 0.16)',
    portal: '0 24px 72px rgba(16, 24, 40, 0.12)',
  },
  effects: {
    glass:
      'linear-gradient(180deg, rgba(255,255,255,0.82) 0%, rgba(255,255,255,0.68) 100%)',
    backdropBlur: '20px',
  },
} as const;

export type DesignTokens = typeof designTokens;
