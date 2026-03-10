/**
 * Editorial Workspace Design Tokens
 *
 * A bold, magazine-inspired design system that breaks from generic SaaS patterns.
 * Strong typography, asymmetric layouts, warm neutrals with vibrant accents.
 */

export const designTokens = {
  /**
   * Color System
   * Base: Warm blacks and off-whites (not pure white/black)
   * Accent: Electric coral (vibrant, memorable, NOT SaaS blue)
   */
  colors: {
    // Base Neutrals - Warm, editorial feel
    neutral: {
      50: '#FAFAF9',   // Soft white (backgrounds)
      100: '#F5F5F4',  // Lightest gray (cards)
      200: '#E7E5E4',  // Light gray (borders)
      300: '#D6D3D1',  // Muted gray
      400: '#A8A29E',  // Mid gray (secondary text)
      500: '#78716C',  // Dark gray (tertiary text)
      600: '#57534E',  // Darker gray
      700: '#44403C',  // Almost black (secondary headings)
      800: '#292524',  // Rich black (primary headings)
      900: '#1C1917',  // True black (body text)
    },

    // Accent - Electric Coral (distinctive, energetic)
    accent: {
      50: '#FFF1F2',
      100: '#FFE4E6',
      200: '#FECDD3',
      300: '#FDA4AF',
      400: '#FB7185',
      500: '#F43F5E',  // PRIMARY ACCENT
      600: '#E11D48',  // Hover state
      700: '#BE123C',
      800: '#9F1239',
      900: '#881337',
    },

    // Success, Warning, Error (editorial-appropriate tones)
    success: {
      50: '#F0FDF4',
      500: '#10B981',  // Emerald green
      600: '#059669',
    },
    warning: {
      50: '#FFFBEB',
      500: '#F59E0B',  // Amber
      600: '#D97706',
    },
    error: {
      50: '#FEF2F2',
      500: '#EF4444',  // Red
      600: '#DC2626',
    },

    // Special: For code/technical elements
    code: {
      bg: '#1C1917',
      text: '#FAFAF9',
      accent: '#FB7185',
    }
  },

  /**
   * Typography System
   * Display: Distinctive serif for headlines (editorial feel)
   * Body: Refined sans-serif for readability
   * Mono: Technical content
   */
  typography: {
    // Font families
    fonts: {
      display: "'Newsreader', 'Georgia', serif",  // Editorial serif
      body: "'Inter', 'Helvetica Neue', sans-serif",  // Inter OK for body text
      mono: "'JetBrains Mono', 'Courier New', monospace",
    },

    // Type scale (Major Third - 1.25x ratio)
    scale: {
      xs: '0.64rem',    // 10px
      sm: '0.8rem',     // 13px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.563rem', // 25px
      '3xl': '1.953rem', // 31px
      '4xl': '2.441rem', // 39px
      '5xl': '3.052rem', // 49px
      '6xl': '3.815rem', // 61px
      '7xl': '4.768rem', // 76px
    },

    // Font weights
    weights: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
    },

    // Line heights
    leading: {
      tight: 1.2,
      snug: 1.375,
      normal: 1.5,
      relaxed: 1.625,
      loose: 1.75,
    },

    // Letter spacing
    tracking: {
      tighter: '-0.05em',
      tight: '-0.025em',
      normal: '0',
      wide: '0.025em',
      wider: '0.05em',
      widest: '0.1em',
    }
  },

  /**
   * Spacing System
   * Base: 4px increments for precision
   */
  spacing: {
    0: '0',
    1: '0.25rem',   // 4px
    2: '0.5rem',    // 8px
    3: '0.75rem',   // 12px
    4: '1rem',      // 16px
    5: '1.25rem',   // 20px
    6: '1.5rem',    // 24px
    8: '2rem',      // 32px
    10: '2.5rem',   // 40px
    12: '3rem',     // 48px
    16: '4rem',     // 64px
    20: '5rem',     // 80px
    24: '6rem',     // 96px
    32: '8rem',     // 128px
  },

  /**
   * Border Radius
   * Subtle, not overly rounded (editorial feel)
   */
  radius: {
    none: '0',
    sm: '2px',      // Barely rounded
    base: '4px',    // Default
    md: '6px',
    lg: '8px',
    xl: '12px',
    full: '9999px',
  },

  /**
   * Shadows
   * Subtle elevation for editorial feel
   */
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    // Editorial special: lifted effect
    lifted: '0 2px 0 0 rgba(0, 0, 0, 0.1)',
    liftedHover: '0 4px 0 0 rgba(0, 0, 0, 0.15)',
  },

  /**
   * Animation Timing
   * Quick, responsive transitions
   */
  transitions: {
    fast: '100ms',
    base: '150ms',
    slow: '300ms',
    slower: '500ms',
  },

  /**
   * Breakpoints
   * Mobile-first responsive design
   */
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  }
} as const;

export type DesignTokens = typeof designTokens;
