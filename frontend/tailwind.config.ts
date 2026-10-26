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
          400: "#E45B46",
          600: "#C94B39",
        },
        surface: {
          DEFAULT: "#101012",
          1: "#19191C",
          2: "#1E1E21",
          3: "#2A2A2E",
          4: "#37373B",
        },
        ink: {
          DEFAULT: "#F2EEE6",
          2: "#AAA69D",
          3: "#807D76",
        },
      },
    },
  },
  plugins: [],
}
