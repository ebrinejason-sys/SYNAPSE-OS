/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        'synapse': {
          green: '#22c55e',
          emerald: '#10b981',
          accent: '#0ea5e9',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-in-out',
        'pulse-slow': 'pulse-slow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideIn: {
          from: { transform: 'translateY(10px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        'pulse-slow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
    },
  },
  plugins: [
    function ({ addComponents, theme }) {
      addComponents({
        // Buttons
        '.btn-primary': {
          '@apply px-4 py-2.5 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg': {},
        },
        '.btn-secondary': {
          '@apply px-4 py-2.5 bg-neutral-100 text-neutral-900 rounded-lg font-medium border border-neutral-300 hover:bg-neutral-200 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed': {},
        },
        '.btn-outline': {
          '@apply px-4 py-2.5 border-2 border-green-500 text-green-500 rounded-lg font-medium hover:bg-green-50 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed': {},
        },
        '.btn-ghost': {
          '@apply px-4 py-2.5 text-green-500 rounded-lg font-medium hover:bg-green-50 transition-all duration-200 active:scale-95': {},
        },
        '.btn-danger': {
          '@apply px-4 py-2.5 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed': {},
        },
        '.btn-sm': {
          '@apply px-3 py-1.5 text-sm': {},
        },
        '.btn-lg': {
          '@apply px-6 py-3 text-lg': {},
        },
        // Cards
        '.card': {
          '@apply bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200': {},
        },
        '.card-elevated': {
          '@apply bg-white rounded-xl border border-gray-200 shadow-md hover:shadow-lg transition-all duration-200': {},
        },
        '.card-interactive': {
          '@apply bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer hover:border-green-500/50 hover:bg-green-50/30': {},
        },
        // Inputs
        '.input': {
          '@apply w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200': {},
        },
        '.input-sm': {
          '@apply px-3 py-1.5 text-sm': {},
        },
        // Badges
        '.badge': {
          '@apply inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold': {},
        },
        '.badge-success': {
          '@apply bg-green-100 text-green-800': {},
        },
        '.badge-warning': {
          '@apply bg-amber-100 text-amber-800': {},
        },
        '.badge-error': {
          '@apply bg-red-100 text-red-800': {},
        },
        '.badge-info': {
          '@apply bg-blue-100 text-blue-800': {},
        },
        '.badge-neutral': {
          '@apply bg-neutral-100 text-neutral-800': {},
        },
        // Status Indicators
        '.status-dot': {
          '@apply inline-block w-2.5 h-2.5 rounded-full animate-pulse': {},
        },
        '.status-active': {
          '@apply bg-green-500': {},
        },
        '.status-inactive': {
          '@apply bg-neutral-400': {},
        },
        '.status-warning': {
          '@apply bg-amber-500': {},
        },
        '.status-error': {
          '@apply bg-red-500': {},
        },
        // Tables
        '.table-row': {
          '@apply border-b border-gray-200 hover:bg-neutral-50 transition-colors duration-150': {},
        },
        '.table-cell': {
          '@apply px-4 py-3 text-sm': {},
        },
        '.table-header': {
          '@apply px-4 py-3 text-xs font-bold text-gray-700 bg-gray-100 uppercase tracking-wider': {},
        },
        // Alerts
        '.alert': {
          '@apply px-4 py-3 rounded-lg border': {},
        },
        '.alert-success': {
          '@apply bg-green-50 border-green-300 text-green-800': {},
        },
        '.alert-warning': {
          '@apply bg-amber-50 border-amber-300 text-amber-800': {},
        },
        '.alert-error': {
          '@apply bg-red-50 border-red-300 text-red-800': {},
        },
        '.alert-info': {
          '@apply bg-blue-50 border-blue-300 text-blue-800': {},
        },
        // Typography
        '.heading-1': {
          '@apply text-4xl font-bold text-gray-900': {},
        },
        '.heading-2': {
          '@apply text-3xl font-bold text-gray-900': {},
        },
        '.heading-3': {
          '@apply text-2xl font-semibold text-gray-900': {},
        },
        '.heading-4': {
          '@apply text-xl font-semibold text-gray-700': {},
        },
        '.text-muted': {
          '@apply text-gray-600': {},
        },
        // Utility Classes
        '.glass': {
          '@apply bg-white/80 backdrop-blur-md border border-white/20 rounded-xl': {},
        },
        '.gradient-primary': {
          '@apply bg-gradient-to-r from-green-500 to-green-600': {},
        },
        '.gradient-emerald': {
          '@apply bg-gradient-to-r from-emerald-500 to-teal-500': {},
        },
      });
    },
  ],
};
