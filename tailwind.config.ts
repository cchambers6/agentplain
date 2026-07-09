import type { Config } from "tailwindcss";
import { colorHex, motion } from "./lib/brand/tokens";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: colorHex,
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      maxWidth: {
        prose: "65ch",
        wide: "1180px",
      },
      letterSpacing: {
        eyebrow: "0.18em",
      },
      // Motion tokens — duration-quick/settle/drift + ease-out-soft/travel.
      // Values come from lib/brand/tokens.ts `motion` (single source); the CSS
      // variables in globals.css mirror them for keyframe rules.
      transitionDuration: {
        quick: motion.durations.quick,
        settle: motion.durations.settle,
        drift: motion.durations.drift,
      },
      transitionTimingFunction: {
        "out-soft": motion.easings.outSoft,
        travel: motion.easings.travel,
      },
    },
  },
  plugins: [],
};

export default config;
