/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bb-black': '#0b0b0c',
        'bb-gray': '#b0b0b0',
        'bb-bone': '#f0ece4',
        'bb-red': '#c43030',
        'bb-red-dark': '#8a2020',
        'bb-red-glow': '#6a1818',
        'bb-ash': '#808080',
        'bb-fog': '#4a4a4a',
        'bb-teal': '#8fbaa8',
        'bb-teal-dark': '#6a9a88',
      },
      fontFamily: {
        'serif': ['Liberation Serif', 'Georgia', 'serif'],
      },
      animation: {
        'pulse-red': 'pulse-red 2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
      },
      keyframes: {
        'pulse-red': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(196, 48, 48, 0.4)' },
          '50%': { boxShadow: '0 0 20px 5px rgba(196, 48, 48, 0.2)' },
        },
        'fadeIn': {
          'from': { opacity: '0', transform: 'translateY(-10px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
