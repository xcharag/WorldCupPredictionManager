/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#0f1623',
          surface: '#1a2436',
          elevated: '#243048',
          border: '#2d3f5c',
          primary: '#22c55e',
          'primary-dark': '#16a34a',
          accent: '#f59e0b',
          danger: '#ef4444',
          text: '#f1f5f9',
          muted: '#94a3b8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
