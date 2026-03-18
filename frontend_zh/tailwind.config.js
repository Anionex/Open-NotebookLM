/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#8d243c',
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
        },
        'ios-gray': {
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
        success: {
          50: '#edf9f2',
          500: '#21a366',
          600: '#1b8352',
        },
        warning: {
          50: '#fff7e8',
          500: '#d28a22',
          600: '#b06e10',
        },
        error: {
          50: '#fef1f2',
          500: '#d1435b',
          600: '#b11e3a',
        },
        background: '#f6f4f2',
        paper: '#fffdfb',
        surface: '#f8fafd',
      },
      fontFamily: {
        display: ['"Noto Serif SC"', '"Cormorant Garamond"', 'serif'],
        sans: ['Inter', '"SF Pro Display"', '"PingFang SC"', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SFMono-Regular"', '"Courier New"', 'monospace'],
      },
      borderRadius: {
        ios: '18px',
        'ios-lg': '24px',
        'ios-xl': '30px',
        'ios-2xl': '36px',
      },
      boxShadow: {
        'ios-sm': '0 8px 20px rgba(16, 24, 40, 0.06)',
        ios: '0 18px 48px rgba(16, 24, 40, 0.09)',
        'ios-lg': '0 26px 70px rgba(16, 24, 40, 0.12)',
        'ios-xl': '0 36px 90px rgba(16, 24, 40, 0.16)',
        portal: '0 24px 72px rgba(16, 24, 40, 0.12)',
      },
      backdropBlur: {
        ios: '20px',
      },
      backgroundImage: {
        'portal-glow':
          'radial-gradient(circle at top left, rgba(141,36,60,0.14), transparent 32%), radial-gradient(circle at top right, rgba(92,124,190,0.12), transparent 28%), linear-gradient(180deg, rgba(255,255,255,0.86) 0%, rgba(248,250,252,0.76) 100%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(18px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 280ms ease-out',
      },
    },
  },
  plugins: [],
};
