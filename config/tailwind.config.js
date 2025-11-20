/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'media', // Automatically uses system preference
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
      fontSize: {
        'presentation-title': ['3rem', { lineHeight: '1.2' }],
        'presentation-content': ['4rem', { lineHeight: '1.4' }],
        'presentation-translation': ['2rem', { lineHeight: '1.5' }],
      },
      screens: {
        'xs': '475px',
      },
    },
  },
  plugins: [],
}
