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
  onHoldSale?: () => void
  onResumeSale?: () => void
  onClose?: () => void
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
  return target.isContentEditable
}

/**
 * POS accelerators modelled on Tally voucher keys, plus existing F-key map.
 * Never the only way to complete a sale — mouse/touch still works.
 *
 * Tally-aligned:
 *   F5          Payment / amount paid
 *   F6          Receipt / payment method (existing)
 *   F8          Sales → complete sale
 *   Ctrl+A      Accept
 *   Ctrl+Enter  Accept
 *   Alt+C       Customer
 *   Escape      Close
 *
 * Existing Synapse:
 *   F2 patient, F3 products, F4 Rx, F8 hold was remapped — hold stays F9 dual with resume;
 *   Hold remains F8 legacy? We keep F8 as Sales (Tally) and Hold as Shift+F8 / previous F8→hold moved.
 *   Hold: F9 was resume; now Hold = Shift+F8, Resume = F9 (unchanged resume).
 *   Actually previous: F8 hold, F9 resume. Tally F8 is Sales.
 *   Compromise: F8 = complete sale (Tally Sales), Shift+F8 = hold, F9 = resume.
 */
export function usePosKeyboardShortcuts(handlers: PosShortcutHandlers) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handlers.onClose?.()
        return
      }

      const ctrl = event.ctrlKey || event.metaKey
      const alt = event.altKey
      const shift = event.shiftKey

      // Ctrl+A / Ctrl+Enter → Accept sale (even from inputs)
      if (ctrl && !alt && (event.key === "Enter" || event.key.toLowerCase() === "a")) {
        // Allow Ctrl+A in text fields only when not selecting-all for edit… Tally Accept wins in POS.
        if (event.key.toLowerCase() === "a" && isTypingTarget(event.target) && !event.shiftKey) {
          // Still accept — cashiers expect Ctrl+A = save in Tally, not select-all.
        }
        event.preventDefault()
        handlers.onCompleteSale?.()
        return
      }

      // Alt+C → Customer
      if (alt && !ctrl && event.key.toLowerCase() === "c") {
        event.preventDefault()
        handlers.onCustomer?.()
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
      if (event.key === "F5") {
        event.preventDefault()
        handlers.onAmountPaid?.()
        return
      }
      if (event.key === "F6") {
        event.preventDefault()
        handlers.onPayment?.()
        return
      }
      if (event.key === "F8") {
        event.preventDefault()
        if (shift) {
          handlers.onHoldSale?.()
        } else {
          handlers.onCompleteSale?.()
        }
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
