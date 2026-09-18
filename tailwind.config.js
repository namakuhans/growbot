/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/dashboard/views/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        brand: "#37FF00",
        darkbg: "#0b0c10",
        panelbg: "rgba(18, 20, 29, 0.7)"
      }
    },
  },
  plugins: [],
}
