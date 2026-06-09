import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}'],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1rem', sm: '1.5rem', lg: '2rem' },
      screens: { sm: '640px', md: '768px', lg: '1024px', xl: '1280px', '2xl': '1440px' },
    },
    extend: {
      colors: {
        brand: {
          primary: '#C41E3A',
          'primary-50':  '#f9e5e7',
          'primary-100': '#f3cccf',
          'primary-600': '#b01a34',
          'primary-700': '#8b1628',
          secondary: '#1a1a2e',
          accent: '#F59E0B',
        },
        ink: {
          50:  '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
          950: '#020617',
        },
      },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Inter Variable', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono Variable', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'xs':   ['clamp(0.75rem, 0.7rem + 0.25vw, 0.8125rem)',  { lineHeight: '1.5'   }],
        'sm':   ['clamp(0.875rem, 0.83rem + 0.225vw, 0.9375rem)', { lineHeight: '1.5' }],
        'base': ['clamp(1rem, 0.95rem + 0.25vw, 1.0625rem)',      { lineHeight: '1.65' }],
        'lg':   ['clamp(1.125rem, 1.07rem + 0.275vw, 1.1875rem)', { lineHeight: '1.6'  }],
        'xl':   ['clamp(1.25rem, 1.18rem + 0.35vw, 1.375rem)',    { lineHeight: '1.55' }],
        '2xl':  ['clamp(1.5rem, 1.4rem + 0.5vw, 1.75rem)',        { lineHeight: '1.4'  }],
        '3xl':  ['clamp(1.875rem, 1.7rem + 0.875vw, 2.25rem)',    { lineHeight: '1.3'  }],
        '4xl':  ['clamp(2.25rem, 2rem + 1.25vw, 3rem)',           { lineHeight: '1.2'  }],
        '5xl':  ['clamp(3rem, 2.5rem + 2.5vw, 4rem)',             { lineHeight: '1.1'  }],
        '6xl':  ['clamp(3.75rem, 3rem + 3.75vw, 5.25rem)',        { lineHeight: '1.05' }],
        '7xl':  ['clamp(4.5rem, 3.5rem + 5vw, 6.5rem)',           { lineHeight: '1'    }],
      },
      spacing: {
        'section-y':    'clamp(4rem, 3rem + 5vw, 8rem)',
        'section-y-sm': 'clamp(2.5rem, 2rem + 2.5vw, 4.5rem)',
        'section-y-lg': 'clamp(5rem, 4rem + 5vw, 10rem)',
      },
      borderRadius: {
        'sm':   '0.25rem',
        DEFAULT: '0.5rem',
        'md':   '0.5rem',
        'lg':   '0.75rem',
        'xl':   '1rem',
        '2xl':  '1.5rem',
        '3xl':  '2rem',
      },
      boxShadow: {
        'soft':   '0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)',
        'medium': '0 4px 6px -1px rgb(15 23 42 / 0.08), 0 2px 4px -2px rgb(15 23 42 / 0.06)',
        'large':  '0 10px 15px -3px rgb(15 23 42 / 0.08), 0 4px 6px -4px rgb(15 23 42 / 0.05)',
        'xl':     '0 20px 25px -5px rgb(15 23 42 / 0.08), 0 8px 10px -6px rgb(15 23 42 / 0.05)',
        'glow-primary': '0 8px 32px -8px rgba(196, 30, 58, 0.4)',
      },
      transitionTimingFunction: {
        'out-expo':  'cubic-bezier(0.19, 1, 0.22, 1)',
        'out-back':  'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        DEFAULT: '200ms',
        'slow':  '400ms',
      },
    },
  },
  plugins: [forms, typography],
};
