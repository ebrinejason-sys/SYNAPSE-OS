import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { generateSecurePassword, secureRandomInt } from "./secure-random"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: string = 'UGX'): string {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
  }).format(amount)
}

export function generateTransactionNo(): string {
  const date = new Date()
  const year = date.getFullYear().toString().slice(-2)
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const random = String(secureRandomInt(100) * 100 + secureRandomInt(100)).padStart(4, '0')
  return `TXN${year}${month}${day}${random}`
}

export function generateOrderNo(): string {
  const date = new Date()
  const year = date.getFullYear().toString().slice(-2)
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const random = String(secureRandomInt(100) * 100 + secureRandomInt(100)).padStart(4, '0')
  return `ORD${year}${month}${day}${random}`
}

/** CSPRNG password (never emailed; see lib/password-setup.ts for invites). */
export function generatePassword(): string {
  return generateSecurePassword(16)
}
