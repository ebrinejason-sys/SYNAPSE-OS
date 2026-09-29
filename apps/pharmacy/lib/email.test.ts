import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const send = vi.hoisted(() => vi.fn())
vi.mock("resend", () => ({
  Resend: class {
    emails = { send }
  },
}))

describe("sendEmail", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.spyOn(console, "error").mockImplementation(() => {})
    process.env.RESEND_API_KEY = "re_test"
  })

  afterEach(() => {
    vi.restoreAllMocks()
    send.mockReset()
    delete process.env.RESEND_API_KEY
  })

  it("reports success when Resend accepts the message", async () => {
    send.mockResolvedValue({ data: { id: "email-1" }, error: null })
    const { sendEmail } = await import("./email")
    expect(await sendEmail({ to: "supplier@example.test", subject: "PO", html: "<p>PO</p>" })).toMatchObject({ success: true })
  })

  it("reports failure when Resend rejects the message instead of throwing", async () => {
    send.mockResolvedValue({ data: null, error: { name: "validation_error", message: "domain is not verified" } })
    const { sendEmail } = await import("./email")
    expect(await sendEmail({ to: "supplier@example.test", subject: "PO", html: "<p>PO</p>" })).toMatchObject({ success: false })
  })

  it("reports failure without calling Resend when no API key is configured", async () => {
    delete process.env.RESEND_API_KEY
    const { sendEmail } = await import("./email")
    expect(await sendEmail({ to: "supplier@example.test", subject: "PO", html: "<p>PO</p>" })).toMatchObject({ success: false })
    expect(send).not.toHaveBeenCalled()
  })
})
