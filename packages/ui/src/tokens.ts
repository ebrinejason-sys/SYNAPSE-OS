/**
 * SYNAPSE accessibility design tokens.
 * Contrast is part of the definition of done — WCAG 2.2 AA:
 *   normal text 4.5:1, large text 3:1, non-text UI 3:1.
 */

export type ThemeName = "light" | "dark" | "high-contrast"

export type Palette = {
  bg: string
  surface: string
  text: string
  textMuted: string
  border: string
  focus: string
  accent: string
  accentFg: string
  accentText: string
  danger: string
  dangerFg: string
  success: string
  successFg: string
  warning: string
  warningFg: string
}

export const palettes: Record<ThemeName, Palette> = {
  light: {
    bg: "#FFFFFF",
    surface: "#F7F5F0",
    text: "#12141A",
    textMuted: "#3E4A5C",
    border: "#5C6573",
    focus: "#1D4ED8",
    accent: "#9A3412",
    accentFg: "#FFFFFF",
    accentText: "#9A3412",
    danger: "#991B1B",
    dangerFg: "#FFFFFF",
    success: "#14532D",
    successFg: "#FFFFFF",
    warning: "#854D0E",
    warningFg: "#FFFFFF",
  },
  dark: {
    bg: "#07070A",
    surface: "#16161B",
    text: "#F4F1EA",
    textMuted: "#C9C2B3",
    border: "#9A9386",
    focus: "#93C5FD",
    accent: "#C2410C",
    accentFg: "#FFFFFF",
    accentText: "#FDBA74",
    danger: "#FECACA",
    dangerFg: "#07070A",
    success: "#86EFAC",
    successFg: "#07070A",
    warning: "#FCD34D",
    warningFg: "#07070A",
  },
  "high-contrast": {
    bg: "#000000",
    surface: "#000000",
    text: "#FFFFFF",
    textMuted: "#FFFFFF",
    border: "#FFFFFF",
    focus: "#FFFF00",
    accent: "#FFFF00",
    accentFg: "#000000",
    accentText: "#FFFF00",
    danger: "#FF6B6B",
    dangerFg: "#000000",
    success: "#00FF00",
    successFg: "#000000",
    warning: "#FFFF00",
    warningFg: "#000000",
  },
}

function channel(hex: string, i: number): number {
  return Number.parseInt(hex.slice(i, i + 2), 16)
}

function relativeLuminance(hex: string): number {
  const h = hex.replace("#", "")
  const toLin = (c: number) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const r = toLin(channel(h, 0))
  const g = toLin(channel(h, 2))
  const b = toLin(channel(h, 4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg)
  const l2 = relativeLuminance(bg)
  const light = Math.max(l1, l2)
  const dark = Math.min(l1, l2)
  return (light + 0.05) / (dark + 0.05)
}

export function meetsContrast(
  fg: string,
  bg: string,
  level: "aa-normal" | "aa-large" | "aa-ui" = "aa-normal",
): boolean {
  const ratio = contrastRatio(fg, bg)
  if (level === "aa-normal") return ratio >= 4.5
  return ratio >= 3
}

export const CLINICAL_STATES = [
  "CRITICAL",
  "HIGH",
  "LOW",
  "NORMAL",
  "EXPIRED",
  "OUT_OF_STOCK",
  "PENDING",
  "REJECTED",
  "UNVERIFIED",
  "VERIFIED",
] as const

export type ClinicalState = (typeof CLINICAL_STATES)[number]

export const CLINICAL_STATE_COPY: Record<ClinicalState, { label: string; icon: string }> = {
  CRITICAL: { label: "Critical", icon: "⚠" },
  HIGH: { label: "High", icon: "▲" },
  LOW: { label: "Low", icon: "▼" },
  NORMAL: { label: "Normal", icon: "●" },
  EXPIRED: { label: "Expired", icon: "■" },
  OUT_OF_STOCK: { label: "Out of stock", icon: "■" },
  PENDING: { label: "Pending", icon: "…" },
  REJECTED: { label: "Rejected", icon: "✕" },
  UNVERIFIED: { label: "Unverified", icon: "?" },
  VERIFIED: { label: "Verified", icon: "✓" },
}

export const POS_SHORTCUTS = [
  { key: "F2", action: "patient-search", label: "Patient search" },
  { key: "F3", action: "product-search", label: "Product search" },
  { key: "F4", action: "prescription", label: "Prescription" },
  { key: "F6", action: "payment", label: "Payment" },
  { key: "F8", action: "hold-sale", label: "Hold sale" },
  { key: "F9", action: "resume-sale", label: "Resume sale" },
  { key: "Escape", action: "close", label: "Close" },
  { key: "Enter", action: "confirm", label: "Confirm" },
] as const
