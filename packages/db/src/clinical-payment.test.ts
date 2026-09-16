import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { recordEncounterPayment } from "./clinical-payment.ts"

function paymentDb(opts: {
  invoice: Record<string, unknown>
  existingPayment?: Record<string, unknown> | null
}) {
  const payments: Record<string, unknown>[] = opts.existingPayment ? [opts.existingPayment] : []
  let invoice = { ...opts.invoice }
  return {
    payments,
    invoice: () => invoice,
    from(table: string) {
      const self: Record<string, unknown> = {}
      const chain = () => self
      self.select = chain
      self.eq = chain
      self.order = chain
      self.limit = chain
      self.maybeSingle = async () => {
        if (table === "billing_invoices") return { data: invoice, error: null }
        if (table === "billing_payments") return { data: payments[0] ?? null, error: null }
        return { data: null, error: null }
      }
      self.insert = async (row: Record<string, unknown>) => {
        payments.push(row)
        return { error: null }
      }
      self.update = (patch: Record<string, unknown>) => {
        Object.assign(invoice, patch)
        return self
      }
      self.then = (resolve: (v: unknown) => void) => resolve({ error: null })
      return self
    },
  }
}

describe("clinical-payment idempotency", () => {
  it("returns the original payment on retry with the same key instead of ALREADY_PAID", async () => {
    const invoiceId = crypto.randomUUID()
    const paymentId = crypto.randomUUID()
    const db = paymentDb({
      invoice: {
        id: invoiceId,
        patient_id: crypto.randomUUID(),
        status: "paid",
        currency: "UGX",
        total_amount: 10000,
        paid_amount: 10000,
        invoice_number: "INV-1",
      },
      existingPayment: {
        id: paymentId,
        amount: 10000,
        receipt_number: "RCP-1",
      },
    })

    const retry = await recordEncounterPayment(db, {
      tenantId: crypto.randomUUID(),
      hospitalId: crypto.randomUUID(),
      encounterId: crypto.randomUUID(),
      amount: 10000,
      paymentMethod: "cash",
      idempotencyKey: "pay-1",
    })

    assert.equal(retry.created, false)
    assert.equal(retry.paymentId, paymentId)
    assert.equal(db.payments.length, 1)
  })
})
