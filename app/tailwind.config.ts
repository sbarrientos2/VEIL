import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Noir palette
        void: {
          950: "#030305",
          900: "#08080c",
          800: "#0d0d14",
          700: "#14141f",
          600: "#1a1a28",
          500: "#252536",
          400: "#3f3f5c",
          300: "#5c5c82",
          200: "#8585a8",
          100: "#adadc7",
          50: "#d6d6e6",
        },
        // Encrypted violet - the signature color
        cipher: {
          50: "#f3f0ff",
          100: "#e9e3ff",
          200: "#d4c9ff",
          300: "#b49fff",
          400: "#9066ff",
          500: "#7c3aed",
          600: "#6d28d9",
          700: "#5b21b6",
          800: "#4c1d95",
          900: "#3b1578",
        },
        // Accent cyan for success/active states
        flux: {
          400: "#22d3ee",
          500: "#06b6d4",
          600: "#0891b2",
        },
        // Warning/danger
        breach: {
          400: "#f87171",
          500: "#ef4444",
          600: "#dc2626",
        },
        // Success
        sealed: {
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
        },
      },
      fontFamily: {
        // Display: dramatic serif for headlines
        display: ['"Playfair Display"', "Georgia", "serif"],
        // Body: clean sans
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
        // Data/code: sharp monospace
        mono: ['"JetBrains Mono"', '"Fira Code"', "monospace"],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "noise": "url('/noise.svg')",
        "grid-cipher": `linear-gradient(to right, rgba(124, 58, 237, 0.03) 1px, transparent 1px),
                        linear-gradient(to bottom, rgba(124, 58, 237, 0.03) 1px, transparent 1px)`,
      },
      backgroundSize: {
        "grid": "40px 40px",
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "scramble": "scramble 0.1s steps(1) infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
        "float": "float 6s ease-in-out infinite",
        "scan": "scan 8s linear infinite",
      },
      keyframes: {
        scramble: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.8" },
        },
        glow: {
          "0%": { boxShadow: "0 0 20px rgba(124, 58, 237, 0.3)" },
          "100%": { boxShadow: "0 0 40px rgba(124, 58, 237, 0.6)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
      },
      boxShadow: {
        "cipher": "0 0 60px -15px rgba(124, 58, 237, 0.5)",
        "cipher-lg": "0 0 100px -20px rgba(124, 58, 237, 0.6)",
        "inner-cipher": "inset 0 0 60px -30px rgba(124, 58, 237, 0.3)",
      },
    },
  },
  plugins: [],
};

export default config;
