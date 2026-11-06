/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Quicksand"', '"Zen Maru Gothic"', '"Noto Sans TC"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        cream: {
          50: '#FFFDF9',
          100: '#FAF6EE',
          200: '#F4ECE0',
          300: '#EADCCB',
          400: '#DEC9B0',
        },
        cocoa: {
          900: '#3E2C1E',
          800: '#4A3525',
          700: '#634835',
          600: '#7D5F4A',
          500: '#9A7E69',
          400: '#B89F8B',
        },
        quokka: {
          DEFAULT: '#B06D3E',
          dark: '#96592F',
          light: '#D4956A',
          soft: '#F9EBD9',
        },
        butter: {
          DEFAULT: '#F7D97E',
          soft: '#FFF5D6',
          ink: '#7A541E',
        },
        matcha: {
          DEFAULT: '#5E8C6A',
          dark: '#4B7556',
          soft: '#EBF4EC',
          border: '#C9DFCC',
        },
        berry: {
          DEFAULT: '#D96B59',
          dark: '#C05645',
          soft: '#FCECE9',
          border: '#F3C7BF',
        },
      },
    },
  },
  plugins: [],
};
