import type { Config } from "tailwindcss";

export const synapseTheme = {
  extend: {
    colors: {
      synapse: {
        950: "#060D1A",
        900: "#0B1628",
        800: "#112040",
        700: "#1A3060",
        600: "#1E3A8A",
      },
      teal: {
        500: "#00D4AA",
        400: "#00E5B8",
      },
      sky: {
        500: "#0EA5E9",
        400: "#38BDF8",
      },
      acuity: {
        red: "#EF4444",
        orange: "#F97316",
        yellow: "#EAB308",
        green: "#22C55E",
        black: "#374151",
      },
      conf: {
        high: "#22C55E",
        med: "#EAB308",
        low: "#EF4444",
      },
    },
    fontFamily: {
      display: ["var(--font-syne)", "sans-serif"],
      body: ["var(--font-ibm-plex-sans)", "sans-serif"],
      mono: ["var(--font-jetbrains-mono)", "monospace"],
      clinical: ["var(--font-source-serif-4)", "serif"],
    },
    fontSize: {
      "2xs": ["0.625rem", { lineHeight: "0.75rem" }],
    },
    borderRadius: {
      "4xl": "2rem",
    },
    animation: {
      "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      shimmer: "shimmer 2s linear infinite",
    },
    keyframes: {
      shimmer: {
        "0%": { backgroundPosition: "-200% 0" },
        "100%": { backgroundPosition: "200% 0" },
      },
    },
  },
} satisfies Config["theme"];
