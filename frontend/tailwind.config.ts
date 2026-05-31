/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-dm-sans)", "system-ui"],
        mono: ["var(--font-space-mono)", "monospace"],
      },
      colors: {
        brand: {
          400: "#E8593C",
          600: "#C43D22",
        },
        surface: {
          DEFAULT: "#0E0E0F",
          1: "#161618",
          2: "#1E1E21",
          3: "#26262A",
          4: "#303035",
        },
        ink: {
          DEFAULT: "#F2F1EE",
          2: "#A8A7A3",
          3: "#6B6A67",
        },
      },
    },
  },
  plugins: [],
}