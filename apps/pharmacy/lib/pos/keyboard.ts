"use client"

import { useEffect } from "react"

export type PosShortcutHandlers = {
  onPatientSearch?: () => void
  onProductSearch?: () => void
  onPrescription?: () => void
  onPayment?: () => void
  /** Focus amount-paid / tender field (Tally F5 Payment). */
  onAmountPaid?: () => void
  /** Accept / complete sale (Tally Ctrl+A / Ctrl+Enter / F8 Sales). */
  onCompleteSale?: () => void
  /** Focus or open customer/client details (Tally Alt+C). */
  onCustomer?: () => void
  /** Remove last cart line (Tally Ctrl+D). */
  onDeleteLine?: () => void
  /** Clear / abandon cart (Tally Alt+D delete voucher). */
  onClearCart?: () => void
  /** Preview / print receipt (Tally Alt+P / F6 Receipt). */
  onPrintReceipt?: () => void
  /** Switch payment method to CREDIT (Tally Ctrl+F8 Credit Note analogue). */
  onCreditMode?: () => void
  /** Save as order / purchase hold (Tally F9 Purchase analogue). */
  onSaveOrder?: () => void
  onHoldSale?: () => void
  onResumeSale?: () => void
  onClose?: () => void
}

export type PosShortcutAction =
  | "close"
  | "accept"
  | "customer"
  | "patient"
  | "products"
  | "prescription"
  | "amountPaid"
  | "paymentMethod"
  | "completeSale"
  | "holdSale"
  | "resumeSale"
  | "deleteLine"
  | "clearCart"
  | "printReceipt"
  | "creditMode"
  | "saveOrder"

/**
 * Pure key → action map so Tally parity can be unit-tested.
 * Returns null when the keystroke is not a POS accelerator.
 */
export function resolvePosShortcut(event: {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
}): PosShortcutAction | null {
  const key = event.key
  const ctrl = event.ctrlKey || event.metaKey
  const alt = event.altKey
  const shift = event.shiftKey
  const lower = key.length === 1 ? key.toLowerCase() : key

  if (key === "Escape") return "close"

  // Ctrl+A / Ctrl+Enter → Accept (Tally)
  if (ctrl && !alt && (key === "Enter" || lower === "a")) return "accept"

  // Alt+C → create / customer (Tally)
  if (alt && !ctrl && lower === "c") return "customer"

  // Ctrl+D → delete line (Tally)
  if (ctrl && !alt && lower === "d") return "deleteLine"

  // Alt+D → delete voucher / clear cart (Tally)
  if (alt && !ctrl && lower === "d") return "clearCart"

  // Alt+P → print (Tally)
  if (alt && !ctrl && lower === "p") return "printReceipt"

  // Ctrl+P → print
  if (ctrl && !alt && lower === "p") return "printReceipt"

  // Ctrl+F8 → credit note analogue → credit payment mode
  if (ctrl && !alt && key === "F8") return "creditMode"

  if (key === "F2") return "patient"
  if (key === "F3") return "products"
  if (key === "F4") return "prescription"
  if (key === "F5") return "amountPaid"
  if (key === "F6") return "printReceipt" // Tally Receipt voucher → print/preview receipt
  if (key === "F7" && !ctrl && !alt) return "paymentMethod"
  if (key === "F8" && !ctrl) {
    return shift ? "holdSale" : "completeSale"
  }
  if (key === "F9" && !ctrl) return "saveOrder"
  if (key === "F10") return "resumeSale"

  return null
}

export const POS_SHORTCUT_CHEATSHEET: Array<{ keys: string; label: string }> = [
  { keys: "F3", label: "Item" },
  { keys: "F5", label: "Payment amt" },
  { keys: "F6", label: "Receipt" },
  { keys: "F7", label: "Pay method" },
  { keys: "F8", label: "Sales" },
  { keys: "Ctrl+A", label: "Accept" },
  { keys: "Alt+C", label: "Customer" },
  { keys: "Ctrl+D", label: "Del line" },
  { keys: "Alt+D", label: "Clear" },
  { keys: "F9", label: "Order" },
  { keys: "Ctrl+F8", label: "Credit" },
  { keys: "Shift+F8", label: "Hold" },
  { keys: "F10", label: "Resume" },
  { keys: "Alt+P", label: "Print" },
  { keys: "Esc", label: "Close" },
]

/**
 * POS accelerators modelled on Tally.ERP 9 / TallyPrime voucher keys.
 * Never the only way to complete a sale — mouse/touch still works.
 */
export function usePosKeyboardShortcuts(handlers: PosShortcutHandlers) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const action = resolvePosShortcut(event)
      if (!action) return

      event.preventDefault()

      switch (action) {
        case "close":
          handlers.onClose?.()
          break
        case "accept":
        case "completeSale":
          handlers.onCompleteSale?.()
          break
        case "customer":
          handlers.onCustomer?.()
          break
        case "patient":
          handlers.onPatientSearch?.()
          break
        case "products":
          handlers.onProductSearch?.()
          break
        case "prescription":
          handlers.onPrescription?.()
          break
        case "amountPaid":
          handlers.onAmountPaid?.()
          break
        case "paymentMethod":
          handlers.onPayment?.()
          break
        case "holdSale":
          handlers.onHoldSale?.()
          break
        case "resumeSale":
          handlers.onResumeSale?.()
          break
        case "deleteLine":
          handlers.onDeleteLine?.()
          break
        case "clearCart":
          handlers.onClearCart?.()
          break
        case "printReceipt":
          handlers.onPrintReceipt?.()
          break
        case "creditMode":
          handlers.onCreditMode?.()
          break
        case "saveOrder":
          handlers.onSaveOrder?.()
          break
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [handlers])
}
