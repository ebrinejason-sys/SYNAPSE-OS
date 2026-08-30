/**
 * Canonical Synapse marketing + product type system.
 * Used by synapseos.tech (web) and pharm.synapseos.tech (pharmacy).
 *
 * IBM Plex Sans — body, UI, and display headings (weight/tracking carry hierarchy)
 * IBM Plex Mono — receipts, IDs, aligned figures — never long prose
 */
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
        orange: "#F97316",
        "orange-light": "#FB923C",
        "orange-dark": "#EA6500",
        gold: "#E8B84B",
        "gold-light": "#F0CB6E",
        "gold-dark": "#C9960A",
        black: "#07070A",
      },
    },
    fontFamily: {
      sans: ["var(--font-sans)", "IBM Plex Sans", "system-ui", "sans-serif"],
      display: ["var(--font-display)", "IBM Plex Sans", "system-ui", "sans-serif"],
      mono: ["var(--font-mono)", "IBM Plex Mono", "ui-monospace", "monospace"],
      clinical: ["Source Serif 4", "Georgia", "serif"],
    },
    fontSize: {
      "2xs": ["0.625rem", { lineHeight: "0.75rem" }],
      "display-xl": [
        "clamp(2.125rem, 4.2vw + 0.75rem, 3.75rem)",
        { lineHeight: "1.08", letterSpacing: "-0.025em", fontWeight: "600" },
      ],
      "display-l": [
        "clamp(1.875rem, 3vw + 0.75rem, 2.75rem)",
        { lineHeight: "1.12", letterSpacing: "-0.022em", fontWeight: "600" },
      ],
      "heading-1": [
        "clamp(1.625rem, 2vw + 0.75rem, 2rem)",
        { lineHeight: "1.2", letterSpacing: "-0.018em", fontWeight: "600" },
      ],
      "heading-2": [
        "clamp(1.375rem, 1.4vw + 0.75rem, 1.625rem)",
        { lineHeight: "1.25", letterSpacing: "-0.014em", fontWeight: "600" },
      ],
      "heading-3": [
        "clamp(1.1875rem, 1vw + 0.75rem, 1.3125rem)",
        { lineHeight: "1.3", letterSpacing: "-0.01em", fontWeight: "600" },
      ],
      "heading-4": [
        "1.0625rem",
        { lineHeight: "1.35", letterSpacing: "-0.005em", fontWeight: "600" },
      ],
      lead: ["clamp(1.0625rem, 0.4vw + 1rem, 1.1875rem)", { lineHeight: "1.6", fontWeight: "400" }],
      "body-lg": ["1.0625rem", { lineHeight: "1.65", fontWeight: "400" }],
      body: ["0.9375rem", { lineHeight: "1.65", fontWeight: "400" }],
      "body-sm": ["0.875rem", { lineHeight: "1.55", fontWeight: "400" }],
      label: ["0.8125rem", { lineHeight: "1.35", letterSpacing: "0.01em", fontWeight: "600" }],
      caption: ["0.75rem", { lineHeight: "1.45", letterSpacing: "0.01em", fontWeight: "400" }],
      overline: ["0.6875rem", { lineHeight: "1.3", letterSpacing: "0.1em", fontWeight: "600" }],
      "mono-value": ["0.875rem", { lineHeight: "1.35", fontWeight: "500" }],
    },
    maxWidth: {
      "prose-narrow": "42rem",
      display: "24ch",
      "display-xl": "20ch",
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

/** Shadcn-compatible semantic colors — map to HSL CSS variables in globals.css */
export const synapseSemanticColors = {
  background: "hsl(var(--background))",
  foreground: "hsl(var(--foreground))",
  card: {
    DEFAULT: "hsl(var(--card))",
    foreground: "hsl(var(--card-foreground))",
  },
  popover: {
    DEFAULT: "hsl(var(--popover))",
    foreground: "hsl(var(--popover-foreground))",
  },
  primary: {
    DEFAULT: "hsl(var(--primary))",
    foreground: "hsl(var(--primary-foreground))",
  },
  secondary: {
    DEFAULT: "hsl(var(--secondary))",
    foreground: "hsl(var(--secondary-foreground))",
  },
  muted: {
    DEFAULT: "hsl(var(--muted))",
    foreground: "hsl(var(--muted-foreground))",
  },
  accent: {
    DEFAULT: "hsl(var(--accent))",
    foreground: "hsl(var(--accent-foreground))",
  },
  destructive: {
    DEFAULT: "hsl(var(--destructive))",
    foreground: "hsl(var(--destructive-foreground))",
  },
  border: "hsl(var(--border))",
  input: "hsl(var(--input))",
  ring: "hsl(var(--ring))",
} as const;

export const synapseFontFamily = synapseTheme.extend.fontFamily;
export const synapseFontSize = synapseTheme.extend.fontSize;
