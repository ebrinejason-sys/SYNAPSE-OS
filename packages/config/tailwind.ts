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
      brand: {
        orange:       "#F97316",
        "orange-light": "#FB923C",
        "orange-dark":  "#EA6500",
        gold:           "#E8B84B",
        "gold-light":   "#F0CB6E",
        "gold-dark":    "#C9960A",
        black:          "#07070A",
      },
    },
    fontFamily: {
      // Canonical Synapse type system (web · pharmacy · mobile):
      // Bricolage Grotesque (display) · DM Sans (body) · IBM Plex Mono (data).
      sans:    ["var(--font-dm-sans)", "DM Sans", "system-ui", "sans-serif"],
      display: ["var(--font-bricolage)", "Bricolage Grotesque", "DM Sans", "sans-serif"],
      mono:    ["var(--font-ibm-plex-mono)", "IBM Plex Mono", "ui-monospace", "monospace"],
      clinical: ["Source Serif 4", "serif"],
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
