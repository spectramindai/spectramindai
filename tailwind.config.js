/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",

  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],

  theme: {
    extend: {
      colors: {
        primary: "#9d6f38",
        blue: {
          50: "#fff8e8",
          100: "#f7e9bf",
          200: "#ecd184",
          300: "#d8b46d",
          400: "#bf9252",
          500: "#a87534",
          600: "#9d6f38",
          700: "#785026",
          800: "#5c3c1d",
          900: "#3f2d19",
          950: "#2b2118",
        },
        slate: {
          50: "#f8f4ea",
          100: "#ece7dc",
          200: "#ddd5c7",
          300: "#c8c4ba",
          400: "#a39a8b",
          500: "#746b5d",
          600: "#5f574c",
          700: "#4d463b",
          800: "#342f28",
          900: "#26231d",
          950: "#171511",
        },
        gray: {
          50: "#faf7ef",
          100: "#f1eadc",
          200: "#e2d8c8",
          300: "#cbbfac",
          400: "#a99d8c",
          500: "#7c7264",
          600: "#665d51",
          700: "#51483c",
          800: "#393229",
          900: "#25221d",
          950: "#171511",
        },
      },
    },
  },

  plugins: [],
}
