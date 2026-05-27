/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          bg:             'rgb(var(--brand-bg)           / <alpha-value>)',
          surface:        'rgb(var(--brand-surface)      / <alpha-value>)',
          elevated:       'rgb(var(--brand-elevated)     / <alpha-value>)',
          border:         'rgb(var(--brand-border)       / <alpha-value>)',
          navy:           'rgb(var(--brand-navy)         / <alpha-value>)',
          primary:        'rgb(var(--brand-primary)      / <alpha-value>)',
          'primary-dark': 'rgb(var(--brand-primary-dark) / <alpha-value>)',
          accent:         'rgb(var(--brand-accent)       / <alpha-value>)',
          danger:         'rgb(var(--brand-danger)       / <alpha-value>)',
          text:           'rgb(var(--brand-text)         / <alpha-value>)',
          muted:          'rgb(var(--brand-muted)        / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
