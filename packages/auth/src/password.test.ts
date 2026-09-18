import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { hashPassword, verifyPassword } from "./password.ts"

describe("production password hashing", () => {
  it("hashes with bcrypt cost 12 and verifies through the normal path", async () => {
    const password = "E2eAccept!2345"
    const hash = await hashPassword(password)
    assert.match(hash, /^\$2[aby]\$12\$/)
    assert.equal(await verifyPassword(password, hash), true)
    assert.equal(await verifyPassword("wrong-password", hash), false)
  })
})
