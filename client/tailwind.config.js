/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Azzurro brand palette
        azzurro: {
          50:  '#eff8ff',
          100: '#daeeff',
          200: '#bde1ff',
          300: '#8fcdff',
          400: '#5ab0fb',
          500: '#3490f7',
          600: '#1d72eb',
          700: '#165dd8',
          800: '#184baf',
          900: '#194289',
          950: '#132954',
        },
        ocean: {
          DEFAULT: '#0077b6',
          light:   '#00b4d8',
          dark:    '#005f92',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.5rem',
      },
    },
  },
  plugins: [],
};

