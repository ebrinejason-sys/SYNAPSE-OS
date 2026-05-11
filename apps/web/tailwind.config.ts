import type { Config } from "tailwindcss";
import { synapseTheme } from "@synapse/config/tailwind";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: synapseTheme,
  plugins: [],
} satisfies Config;
