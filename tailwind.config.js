/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#E1F5EE",
          100: "#9FE1CB",
          200: "#5DCAA5",
          400: "#1D9E75",
          500: "#0F6E56",
          600: "#085041",
          700: "#04342C"
        },
        up: "#D85A30",
        down: "#1D9E75"
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "\"Segoe UI\"", "Roboto", "sans-serif"],
        mono: ["\"SF Mono\"", "Menlo", "monospace"]
      }
    }
  },
  plugins: []
};
