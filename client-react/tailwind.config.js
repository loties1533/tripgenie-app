/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans:    ['"DM Sans"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        gold:      { DEFAULT: '#C9A84C', light: '#F5E6C0', dark: '#8B6914' },
        ink:       { DEFAULT: '#1A1410', light: '#3D3228' },
        parchment: { DEFAULT: '#FAF7F2', dark: '#F0EBE0' },
        sage:      '#5A7A5E',
        sky:       '#3A6B8A',
        coral:     '#C0634A',
        muted:     '#7A6E62',
      },
      animation: {
        'fade-up':    'fadeUp 0.4s ease forwards',
        'fade-in':    'fadeIn 0.3s ease forwards',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'typing':     'typing 1.2s ease-in-out infinite',
        'shimmer':    'shimmer 1.8s ease-in-out infinite',
      },
      keyframes: {
        fadeUp:   { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        fadeIn:   { from: { opacity: 0 }, to: { opacity: 1 } },
        shimmer:  { '0%,100%': { opacity: .4 }, '50%': { opacity: 1 } },
        typing:   { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-4px)' } },
      },
      backdropBlur: { xs: '2px' },
      boxShadow: {
        'glow-gold': '0 0 24px rgba(201,168,76,0.25)',
        'card':      '0 4px 24px rgba(26,20,16,0.08)',
        'card-lg':   '0 12px 48px rgba(26,20,16,0.14)',
      }
    }
  },
  plugins: []
}
