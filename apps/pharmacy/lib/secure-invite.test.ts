import { describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { createHash } from "node:crypto"

vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: {} }))
import { generateSecurePassword, secureRandomInt } from "./secure-random"
import { hashSetupToken, newSetupToken } from "./password-setup"
import { generateWelcomeEmail } from "./email"

const read = (f: string) => readFileSync(join(__dirname, "..", f), "utf8")

describe("CSPRNG helpers", () => {
  it("generateSecurePassword meets the strength rules and is not repeated", () => {
    const seen = new Set<string>()
    for (let i = 0; i < 200; i += 1) {
      const p = generateSecurePassword(16)
      expect(p).toHaveLength(16)
      expect(p).toMatch(/[A-Z]/)
      expect(p).toMatch(/[a-z]/)
      expect(p).toMatch(/[0-9]/)
      expect(p).toMatch(/[!@#$%^&*]/)
      seen.add(p)
    }
    expect(seen.size).toBe(200)
  })
  it("secureRandomInt stays in range", () => {
    for (let i = 0; i < 500; i += 1) {
      const n = secureRandomInt(7)
      expect(n).toBeGreaterThanOrEqual(0)
      expect(n).toBeLessThan(7)
    }
  })
  it.each(["lib/utils.ts", "lib/email.ts", "lib/secure-random.ts", "app/api/admin/users/route.ts", "../web/src/app/api/mobile/pharmacy/users/route.ts"])(
    "%s has no Math.random password generation",
    (f) => {
      const src = read(f)
      expect(src).not.toMatch(/Math\.random\(\)\s*\*\s*(charset|chars|all|upper|lower|numbers|symbols)/)
    },
  )
})

describe("set-password tokens", () => {
  it("stores only the sha256 of a 256-bit token, matching /api/auth/reset-password", () => {
    const { token, tokenHash } = newSetupToken()
    expect(token).toMatch(/^[0-9a-f]{64}$/)
    expect(tokenHash).toBe(createHash("sha256").update(token).digest("hex"))
    expect(tokenHash).not.toBe(token)
    expect(hashSetupToken(token)).toBe(tokenHash)
  })
  it("reset-password claims the token atomically (used_at IS NULL) before changing the password", () => {
    const src = read("app/api/auth/reset-password/route.ts")
    const claim = src.indexOf(".is('used_at', null)")
    const update = src.indexOf("password_hash: newHash")
    expect(claim).toBeGreaterThan(0)
    expect(claim).toBeLessThan(update)
  })
})

describe("welcome/invite email", () => {
  it("contains the set-password link and no password field; escapes names", () => {
    const html = generateWelcomeEmail("<b>Eve</b>", "eve@x.test", "https://pharm.synapseos.tech/reset-password/abc", "pharmacy_staff")
    expect(html).toContain("https://pharm.synapseos.tech/reset-password/abc")
    expect(html).not.toMatch(/Temporary Password/i)
    expect(html).not.toContain("<b>Eve</b>")
    expect(html).toContain("&lt;b&gt;Eve&lt;/b&gt;")
  })
})
