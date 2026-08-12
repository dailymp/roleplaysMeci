import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: "#fcfcfb",
        "surface-page": "#f9f9f7",
        "surface-dark": "#1a1a19",
        "page-dark": "#0d0d0d",
        ink: "#0b0b0b",
        "ink-dark": "#ffffff",
        "ink-secondary": "#52514e",
        "ink-secondary-dark": "#c3c2b7",
        muted: "#898781",
        hairline: "#e1e0d9",
        "hairline-dark": "#2c2c2a",
        baseline: "#c3c2b7",
        "baseline-dark": "#383835",
        // MECI fase series (categorical slots 1-4, fixed order)
        "fase-m": "#2a78d6",
        "fase-e": "#eb6834",
        "fase-c": "#1baf7a",
        "fase-i": "#eda100",
        // status
        good: "#0ca30c",
        warning: "#fab219",
        serious: "#ec835a",
        critical: "#d03b3b",
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
