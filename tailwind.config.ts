import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F4EEE3",
        "paper-deep": "#EDE5D6",
        ink: "#2A2620",
        "ink-soft": "#3D3830",
        slate: "#3A3D42",
        "slate-soft": "#5A5D62",
        signal: "#5F8060",
        "signal-deep": "#496349",
        amber: "#C9892F",
        rule: "#D9CFBC",
      },
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
    },
  },
  plugins: [],
};

export default config;
