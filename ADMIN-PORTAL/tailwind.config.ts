import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'dark-900': '#020617',
        'dark-800': '#0a192f',
        primary: '#10b981',
        secondary: '#059669',
        nexus: {
          bg: '#020617',
          card: '#0a192f',
          dark: '#f8fafc',
          accent: '#10b981'
        }
      },
      fontFamily: {
        cairo: ['Cairo', 'sans-serif'],
        montserrat: ['Montserrat', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 15px 40px rgba(0, 0, 0, 0.4)',
        glow: '0 0 20px rgba(16, 185, 129, 0.15)',
      },
      borderRadius: {
        xl2: '1.25rem'
      }
    }
  },
  plugins: []
} satisfies Config
