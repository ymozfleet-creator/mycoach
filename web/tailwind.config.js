/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Noto Sans JP"', '"Hiragino Sans"', 'Meiryo', 'system-ui', 'sans-serif'] },
      colors: {
        navy: { DEFAULT: '#0F2A4A', 700: '#16365E', 50: '#EEF3F9' },
        brand: { DEFAULT: '#2563EB', 50: '#EFF5FF', 100: '#DBE8FE', 600: '#1D4ED8' },
        lime: { DEFAULT: '#B7F03C', 600: '#8CC51A' },
        ink: { DEFAULT: '#0F172A', 2: '#475569', 3: '#94A3B8' },
        line: '#E5EAF1',
        canvas: '#F5F7FB',
      },
      borderRadius: { xl2: '1.25rem' },
      boxShadow: { card: '0 1px 2px rgba(15,23,42,.04), 0 4px 16px rgba(15,23,42,.06)', pop: '0 12px 40px rgba(15,23,42,.18)' },
      keyframes: {
        up: { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'none' } },
        sheet: { from: { transform: 'translateY(100%)' }, to: { transform: 'none' } },
        fade: { from: { opacity: 0 }, to: { opacity: 1 } },
        shimmer: { to: { backgroundPosition: '-200% 0' } },
        pop: { '0%': { transform: 'scale(1)' }, '40%': { transform: 'scale(1.08)' }, '100%': { transform: 'scale(1)' } },
      },
      animation: { pop: 'pop .28s cubic-bezier(.2,.7,.2,1)', up: 'up .35s cubic-bezier(.2,.7,.2,1) both', sheet: 'sheet .32s cubic-bezier(.2,.7,.2,1) both', fade: 'fade .2s ease both', shimmer: 'shimmer 1.2s linear infinite' },
    },
  },
  plugins: [],
}
