/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'vt-bg': '#000000',
        'vt-surface': '#0a0a0a',
        'vt-card': '#0E0E12',
        'vt-border': '#1C1C22',
        'vt-green': '#00FF41',
        'vt-green-alt': '#26DE81',
        'vt-orange': '#FF4D00',
        'vt-orange-alt': '#FF9F43',
        'vt-yellow': '#FECA57',
        'vt-red': '#FF4655',
        'vt-blue': '#5C7CFA',
        'vt-dim': '#888888',
        'vt-muted': '#55555E',
        'vt-text': '#EAEAEF',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['"IBM Plex Mono"', '"JetBrains Mono"', 'monospace'],
        heading: ['"Space Grotesk"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
