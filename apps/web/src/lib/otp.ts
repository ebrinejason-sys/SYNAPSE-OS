import { createHash, timingSafeEqual } from 'node:crypto'

export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export function hashOtp(otp: string): string {
  return createHash('sha256').update(otp).digest('hex')
}

export function verifyOtpHash(input: string, stored: string): boolean {
  try {
    const a = Buffer.from(hashOtp(input), 'hex')
    const b = Buffer.from(stored, 'hex')
    if (a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}
