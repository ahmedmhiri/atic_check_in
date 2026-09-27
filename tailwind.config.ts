import type { Config } from "tailwindcss";

// Quiet professional theme: neutral slate surfaces, one restrained accent,
// conventional semantic colours. Everything lives here, so re-theming the whole
// app means editing these tokens.
//
// The ATIC 2.0 token names (navy/brand/accent/cream/mist) are kept so any class
// still referencing them resolves sensibly, but `navy` is now a dark *text*
// ramp rather than a page background.
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0f172a", // headings, primary text
          muted: "#475569", // secondary text
          subtle: "#94a3b8", // tertiary / placeholder
        },
        surface: {
          DEFAULT: "#ffffff", // cards
          page: "#f8fafc", // page background
          subtle: "#f1f5f9", // inset tiles, table headers
        },
        line: {
          DEFAULT: "#e2e8f0",
          strong: "#cbd5e1",
        },
        accent: {
          DEFAULT: "#4f46e5",
          hover: "#4338ca",
          soft: "#eef2ff",
        },
        success: { DEFAULT: "#059669", soft: "#ecfdf5" },
        warn: { DEFAULT: "#d97706", soft: "#fffbeb" },
        danger: { DEFAULT: "#dc2626", hover: "#b91c1c", soft: "#fef2f2" },

        // Legacy names, remapped onto the quiet palette.
        navy: {
          950: "#0f172a",
          900: "#1e293b",
          800: "#334155",
          700: "#475569",
        },
        brand: { DEFAULT: "#4f46e5", 600: "#6366f1" },
        cream: "#f8fafc",
        mist: "#475569",
      },
      fontFamily: {
        sans: ["var(--font-montserrat)", "system-ui", "sans-serif"],
        display: ["var(--font-unbounded)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,.04), 0 1px 3px rgba(15,23,42,.08)",
        raised: "0 2px 4px rgba(15,23,42,.04), 0 4px 12px rgba(15,23,42,.08)",
        // Legacy names from the dark theme, softened.
        glass: "0 1px 2px rgba(15,23,42,.04)",
        glow: "0 1px 2px rgba(15,23,42,.04), 0 1px 3px rgba(15,23,42,.08)",
        block: "0 2px 4px rgba(15,23,42,.04), 0 4px 12px rgba(15,23,42,.08)",
      },
    },
  },
  plugins: [],
};

export default config;
