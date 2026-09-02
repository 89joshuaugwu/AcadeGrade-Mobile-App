/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        acade: {
          void: '#07090F',
          deep: '#0E1322',
          surface: '#141B2E',
          overlay: '#1A243D',
          border: '#1F2B47',
          'border-subtle': '#162038',
          primary: '#6366F1',
          'primary-hover': '#4F46E5',
          'primary-glow': '#818CF8',
          'primary-dim': '#1e1b4b',
          gold: '#F59E0B',
          'gold-hover': '#D97706',
          'gold-dim': '#1C1005',
          success: '#22C55E',
          danger: '#EF4444',
          warning: '#F59E0B',
          info: '#38BDF8',
          text: '#E8EDFF',
          'text-muted': '#8892B0',
          'text-faint': '#4A5580',
        },
        grade: {
          a: '#22C55E', b: '#818CF8', c: '#F59E0B', d: '#F97316', e: '#EF4444', f: '#6B7280',
        },
        class: {
          first: '#22C55E', 'second-upper': '#818CF8', 'second-lower': '#F59E0B',
          third: '#F97316', pass: '#EF4444', fail: '#6B7280',
        },
      },
    },
  },
  plugins: [],
};
