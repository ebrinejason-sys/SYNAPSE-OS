import type { Config } from "tailwindcss";
import { synapseSemanticColors, synapseTheme } from "@synapse/config/tailwind";

export default {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    ...synapseTheme,
    extend: {
      ...synapseTheme.extend,
      colors: {
        ...synapseTheme.extend.colors,
        ...synapseSemanticColors,
      },
      borderRadius: {
        ...synapseTheme.extend.borderRadius,
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
} satisfies Config;
