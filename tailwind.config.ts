import type { Config } from "tailwindcss";

// ATIC brand (from wie-iit.ieee.tn/atic): deep navy, royal-blue gradient, cyan accent.
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: "#00083B",
          900: "#000940",
          800: "#07124F",
          700: "#101C63",
        },
        brand: {
          DEFAULT: "#1D56FF",
          600: "#3662CE",
        },
        accent: "#38B6FF",
      },
      fontFamily: {
        sans: ['"HelveticaNowDisplayW01-Rg"', '"Helvetica Neue"', "Helvetica", "Arial", "sans-serif"],
        display: ['"HelveticaNowDisplay-Medium"', '"Helvetica Neue"', "Helvetica", "Arial", "sans-serif"],
      },
      boxShadow: {
        glass: "0 24px 60px rgba(0, 8, 59, 0.45)",
        glow: "0 10px 30px -8px rgba(29, 86, 255, 0.55)",
      },
    },
  },
  plugins: [],
};

export default config;
