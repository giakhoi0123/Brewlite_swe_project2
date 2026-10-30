import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brew: {
          50: '#fdf8f4',
          100: '#f9eee5',
          200: '#f2dcce',
          300: '#e7c2ab',
          400: '#d99f80',
          500: '#cd815e',
          600: '#be6b4b',
          700: '#9e533d',
          800: '#804537',
          900: '#683a30',
          950: '#381c17',
        },
      },
    },
  },
  plugins: [],
};
export default config;

