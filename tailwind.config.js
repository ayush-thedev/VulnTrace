/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'vt-navy': '#1E338C',
        'vt-deep-navy': '#14246B',
        'vt-ink': '#1A1A2E',
        'vt-muted': '#5A6070',
        'vt-tint': '#E4E7F3',
        'vt-border': '#C9CCD6',
        'vt-card': '#F8F8F8',
        'vt-green': '#2E7D5B',
        'vt-green-light': '#E8F5E9',
        'vt-red': '#C0392B',
        'vt-red-light': '#FBE9E6',
        'vt-amber': '#B7791F',
        'vt-amber-light': '#FBF3E2',
      },
      fontFamily: {
        heading: ['Georgia', 'serif'],
        sans: ['Calibri', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', 'monospace'],
      }
    },
  },
  plugins: [],
}
