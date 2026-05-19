import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#fff0f9',  // hsl(323 100% 97%)
          100: '#ffddf1',  // hsl(323 100% 93%)
          200: '#ffb3e2',  // hsl(323 100% 85%)
          300: '#ff8fd4',  // hsl(323 100% 78%)
          400: '#ff66c4',  // hsl(323 100% 70%)
          500: '#ff52bd',  // hsl(323 100% 66%)
          600: '#ff3eb5',  // hsl(323 100% 62%) — primary
          700: '#ff009d',  // hsl(323 100% 50%)
          900: '#8f0058',  // hsl(323 100% 28%)
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 4px 24px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
} satisfies Config
