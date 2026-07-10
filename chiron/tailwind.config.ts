import type { Config } from "tailwindcss";

// Chiron's own visual system: warm scholar's-study palette.
// Deliberately NOT the agentplain forest/wheat/clay tokens — separate product.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        parchment: "#F7F2E9",
        ink: "#2B2118",
        walnut: "#5C4633",
        ochre: "#B8860B",
        sage: "#7A8B6F",
        terracotta: "#A0522D",
      },
      fontFamily: {
        serif: ["Georgia", "Cambria", "'Times New Roman'", "serif"],
        sans: ["system-ui", "-apple-system", "'Segoe UI'", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
