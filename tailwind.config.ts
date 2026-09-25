import type { Config } from "tailwindcss";

// ATIC 2.0 brand (from the "ATIC Congress Website Mockups" v3):
// ink #0b0b12, indigo #2A2FE0, amber #F2A93B, cream #f2f0ea.
// Token names are kept from the previous theme so every page picks these up.
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#0b0b12", // page background (ink)
          900: "#12121c", // raised surface
          800: "#1b1b29",
          700: "#2a2a35",
        },
        brand: {
          DEFAULT: "#2A2FE0", // indigo
          600: "#5B60FF",
        },
        accent: "#F2A93B", // amber
        cream: "#f2f0ea",
        mist: "#c8c8d8", // nav / muted text on dark
      },
      fontFamily: {
        sans: ["var(--font-montserrat)", "Montserrat", "Arial", "sans-serif"],
        display: ["var(--font-unbounded)", "Unbounded", "Arial Black", "sans-serif"],
        mono: ["var(--font-jetbrains)", '"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        glass: "0 1px 0 rgba(255, 255, 255, 0.04) inset",
        // Hard offset block shadow, as on the mockup's "Your logo here" card.
        glow: "5px 5px 0 0 #2A2FE0",
        block: "6px 6px 0 0 #2A2FE0",
      },
    },
  },
  plugins: [],
};

export default config;
