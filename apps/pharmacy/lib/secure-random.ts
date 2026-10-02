/** Unbiased CSPRNG helpers (Web Crypto: works in Node 18+, edge and browser bundles). */
export function secureRandomInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > 256) {
    throw new RangeError("secureRandomInt supports 1..256")
  }
  const limit = 256 - (256 % maxExclusive)
  const buf = new Uint8Array(1)
  for (;;) {
    globalThis.crypto.getRandomValues(buf)
    if (buf[0] < limit) return buf[0] % maxExclusive
  }
}

export function secureRandomString(length: number, charset: string): string {
  let out = ""
  for (let i = 0; i < length; i += 1) out += charset[secureRandomInt(charset.length)]
  return out
}

/** Password that satisfies validatePasswordStrength (upper, lower, digit, symbol, >= 12). */
export function generateSecurePassword(length = 16): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"
  const lower = "abcdefghijkmnpqrstuvwxyz"
  const digits = "23456789"
  const symbols = "!@#$%^&*"
  const all = upper + lower + digits + symbols
  const chars = [
    secureRandomString(1, upper),
    secureRandomString(1, lower),
    secureRandomString(1, digits),
    secureRandomString(1, symbols),
    ...secureRandomString(Math.max(length, 12) - 4, all),
  ]
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = secureRandomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join("")
}
