import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1d2b2a",
        sage: { 50: "#f2f6f4", 100: "#e2ece8", 300: "#a8c6ba", 500: "#5c8d7a", 600: "#47705f", 700: "#365548" },
        clay: { 100: "#f6ece4", 500: "#c87a52", 600: "#a9603c" },
      },
      fontFamily: {
        sans: ['"Hiragino Sans"', '"Hiragino Kaku Gothic ProN"', "Meiryo", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
