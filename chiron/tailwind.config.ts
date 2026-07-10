import type { Config } from "tailwindcss";

// Chiron's own visual system: warm scholar's-study palette.
// Deliberately NOT the agentplain forest/wheat/clay tokens — separate product.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        parchment: "#F7F1E6",
        ink: "#1E1B18",
        walnut: "#5C4633",
        ochre: "#B8860B",
        sage: "#7A8B6F",
        terracotta: "#A0522D",
      },
      fontFamily: {
        // --font-wordmark = Cormorant Garamond Bold via next/font/local (layout.tsx)
        wordmark: ["var(--font-wordmark)", "Georgia", "serif"],
        serif: ["Georgia", "Cambria", "'Times New Roman'", "serif"],
        sans: ["system-ui", "-apple-system", "'Segoe UI'", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
