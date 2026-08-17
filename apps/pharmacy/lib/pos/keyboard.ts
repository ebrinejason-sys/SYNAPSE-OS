"use client"

import { useEffect } from "react"

export type PosShortcutHandlers = {
  onPatientSearch?: () => void
  onProductSearch?: () => void
  onPrescription?: () => void
  onPayment?: () => void
  onHoldSale?: () => void
  onResumeSale?: () => void
  onClose?: () => void
}

/**
 * Optional POS accelerators. Standard tab/enter/space interaction still works
 * without these keys — they must never become the only way to complete a sale.
 */
export function usePosKeyboardShortcuts(handlers: PosShortcutHandlers) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handlers.onClose?.()
        return
      }
      if (event.key === "F2") {
        event.preventDefault()
        handlers.onPatientSearch?.()
        return
      }
      if (event.key === "F3") {
        event.preventDefault()
        handlers.onProductSearch?.()
        return
      }
      if (event.key === "F4") {
        event.preventDefault()
        handlers.onPrescription?.()
        return
      }
      if (event.key === "F6") {
        event.preventDefault()
        handlers.onPayment?.()
        return
      }
      if (event.key === "F8") {
        event.preventDefault()
        handlers.onHoldSale?.()
        return
      }
      if (event.key === "F9") {
        event.preventDefault()
        handlers.onResumeSale?.()
        return
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [handlers])
}
