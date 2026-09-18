"use client"

import { useState, useEffect } from "react"
import { DemoShell } from "../../../components/demo/DemoShell"
import { DemoEmptyState } from "../../../components/demo/DemoEmptyState"
import { applyStationSession } from "../../../lib/demo/stations"
import {
  getEncounters,
  getPerson,
  getInvoiceByEncounter,
  createInvoice,
  createInvoiceItem,
  createPayment,
  updateEncounter,
  appendTimelineEvent,
  appendAuditEvent
} from "../../../lib/demo/browser-repository"

export default function BillingDemoPage() {
  const [encounters, setEncounters] = useState<any[]>([])
  const [selectedEncounter, setSelectedEncounter] = useState<any>(null)
  const [patient, setPatient] = useState<any>(null)
  const [invoice, setInvoice] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [paid, setPaid] = useState(false)
  const [closed, setClosed] = useState(false)

  // Invoice items
  const [consultationFee, setConsultationFee] = useState("50000")
  const [labFees, setLabFees] = useState("30000")
  const [medicationFees, setMedicationFees] = useState("20000")
  const [otherFees, setOtherFees] = useState("0")
  const [discount, setDiscount] = useState("0")

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "mobile_money" | "card" | "bank_transfer" | "insurance" | "government">("cash")
  const [paymentReference, setPaymentReference] = useState("")

  useEffect(() => {
    loadEncounters()
  }, [])

  useEffect(() => {
    if (selectedEncounter) {
      loadEncounterData()
    }
  }, [selectedEncounter])

  async function loadEncounters() {
    try {
      const encs = await getEncounters()
      const activeEncs = encs.filter(e => e.status === "active")
      setEncounters(activeEncs)
      
      if (activeEncs.length > 0 && !selectedEncounter) {
        setSelectedEncounter(activeEncs[0])
      }
    } catch (error) {
      console.error("Failed to load encounters:", error)
    } finally {
      setLoading(false)
    }
  }

  async function loadEncounterData() {
    if (!selectedEncounter) return

    try {
      const [p, inv] = await Promise.all([
        getPerson(selectedEncounter.personId),
        getInvoiceByEncounter(selectedEncounter.id)
      ])

      setPatient(p)
      setInvoice(inv)
    } catch (error) {
      console.error("Failed to load encounter data:", error)
    }
  }

  async function handleGenerateInvoice() {
    if (!selectedEncounter || !patient) return

    setSubmitting(true)
    try {
      const consultAmount = parseFloat(consultationFee) || 0
      const labAmount = parseFloat(labFees) || 0
      const medAmount = parseFloat(medicationFees) || 0
      const otherAmount = parseFloat(otherFees) || 0
      const discountAmount = parseFloat(discount) || 0

      const subtotal = consultAmount + labAmount + medAmount + otherAmount
      const total = subtotal - discountAmount

      // Create invoice
      const inv = await createInvoice({
        encounterId: selectedEncounter.id,
        personId: patient.id,
        facilityId: "demo-hospital",
        invoiceNumber: `INV-${Date.now().toString().slice(-8)}`,
        status: "issued",
        subtotal,
        discount: discountAmount,
        tax: 0,
        total,
        paidAmount: 0,
        balance: total
      })

      // Create invoice items
      if (consultAmount > 0) {
        await createInvoiceItem({
          invoiceId: inv.id,
          encounterId: selectedEncounter.id,
          itemType: "consultation",
          description: "Consultation Fee",
          quantity: 1,
          unitPrice: consultAmount,
          totalPrice: consultAmount
        })
      }

      if (labAmount > 0) {
        await createInvoiceItem({
          invoiceId: inv.id,
          encounterId: selectedEncounter.id,
          itemType: "lab",
          description: "Laboratory Tests",
          quantity: 1,
          unitPrice: labAmount,
          totalPrice: labAmount
        })
      }

      if (medAmount > 0) {
        await createInvoiceItem({
          invoiceId: inv.id,
          encounterId: selectedEncounter.id,
          itemType: "medication",
          description: "Medications",
          quantity: 1,
          unitPrice: medAmount,
          totalPrice: medAmount
        })
      }

      if (otherAmount > 0) {
        await createInvoiceItem({
          invoiceId: inv.id,
          encounterId: selectedEncounter.id,
          itemType: "other",
          description: "Other Fees",
          quantity: 1,
          unitPrice: otherAmount,
          totalPrice: otherAmount
        })
      }

      await appendTimelineEvent({
        personId: patient.id,
        encounterId: selectedEncounter.id,
        facilityId: "demo-hospital",
        actorId: "cashier-demo",
        eventType: "invoice_generated",
        title: "Invoice generated",
        description: `Invoice No: ${inv.invoiceNumber} · Total: UGX ${total.toLocaleString()}`
      })

      setInvoice(inv)
    } catch (error) {
      console.error("Failed to generate invoice:", error)
      alert("Failed to generate invoice. Check console for details.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePayment() {
    if (!invoice || !selectedEncounter || !patient) return

    setSubmitting(true)
    try {
      // Create payment
      await createPayment({
        invoiceId: invoice.id,
        encounterId: selectedEncounter.id,
        personId: patient.id,
        facilityId: "demo-hospital",
        amount: invoice.total,
        method: paymentMethod,
        reference: paymentReference.trim() || undefined,
        receivedBy: "cashier-demo",
        receivedAt: new Date().toISOString()
      })

      await appendTimelineEvent({
        personId: patient.id,
        encounterId: selectedEncounter.id,
        facilityId: "demo-hospital",
        actorId: "cashier-demo",
        eventType: "payment_received",
        title: "Payment received",
        description: `${paymentMethod} · UGX ${invoice.total.toLocaleString()}`
      })

      await appendAuditEvent({
        actorId: "cashier-demo",
        actorRole: "cashier",
        facilityId: "demo-hospital",
        action: "payment.receive",
        entityType: "payment",
        entityId: invoice.id,
        personId: patient.id,
        encounterId: selectedEncounter.id
      })

      setPaid(true)
    } catch (error) {
      console.error("Failed to process payment:", error)
      alert("Failed to process payment. Check console for details.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCloseVisit() {
    if (!selectedEncounter) return
    setSubmitting(true)
    try {
      await updateEncounter(selectedEncounter.id, {
        status: "completed",
        completedAt: new Date().toISOString()
      })
      await appendTimelineEvent({
        personId: patient.id,
        encounterId: selectedEncounter.id,
        facilityId: "demo-hospital",
        actorId: "cashier-demo",
        eventType: "encounter_completed",
        title: "Visit closed",
        description: "Encounter completed after payment"
      })
      setClosed(true)
    } catch (error) {
      console.error("Failed to close visit:", error)
      alert("Failed to close visit.")
    } finally {
      setSubmitting(false)
    }
  }

  function resetForm() {
    setPaid(false)
    setSelectedEncounter(null)
    setPatient(null)
    setInvoice(null)
    setConsultationFee("50000")
    setLabFees("30000")
    setMedicationFees("20000")
    setOtherFees("0")
    setDiscount("0")
    setPaymentReference("")
    loadEncounters()
  }

  if (loading) {
    return (
      <DemoShell title="Billing" description="Care summary, payment, then close the visit." requiresRole={["cashier", "reception", "admin"]}>
        <div className="demo-card h-24" aria-hidden="true" />
      </DemoShell>
    )
  }

  if (closed) {
    return (
      <DemoShell title="Billing" description="Care summary, payment, then close the visit." requiresRole={["cashier", "reception", "admin"]}>
        <div className="demo-empty space-y-4 text-center">
          <h2 className="text-2xl font-bold">Journey complete</h2>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Payment received and the visit is closed.</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <a className="demo-btn-primary" href="/demo/timeline" onClick={() => applyStationSession("timeline")}>
              View Patient Timeline
            </a>
            <button type="button" className="demo-btn-secondary" onClick={() => window.location.assign("/demo/login")}>
              Explore Another Role
            </button>
          </div>
        </div>
      </DemoShell>
    )
  }

  if (encounters.length === 0) {
    return (
      <DemoShell title="Billing" description="Care summary, payment, then close the visit." requiresRole={["cashier", "reception", "admin"]}>
        <DemoEmptyState
          title="No active encounter ready for billing"
          body="Resume the patient journey from Reception to create a visit."
          primaryLabel="Resume Patient Journey"
          primaryStation="reception"
        />
      </DemoShell>
    )
  }

  const subtotal = (parseFloat(consultationFee) || 0) + (parseFloat(labFees) || 0) + (parseFloat(medicationFees) || 0) + (parseFloat(otherFees) || 0)
  const discountAmount = parseFloat(discount) || 0
  const total = subtotal - discountAmount

  return (
    <DemoShell title="Billing" requiresRole={["cashier", "reception", "admin"]}>
      <div className="space-y-6">
        {/* Encounter Selection */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="font-semibold text-lg mb-4">Active Encounters ({encounters.length})</h2>
          <div className="space-y-2">
            {encounters.map(enc => (
              <button
                key={enc.id}
                onClick={() => setSelectedEncounter(enc)}
                className={`w-full p-4 rounded border text-left transition-colors ${
                  selectedEncounter?.id === enc.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-accent"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-semibold">Encounter: {enc.id.slice(0, 8)}</p>
                    <p className="text-sm text-muted-foreground">
                      {enc.visitType} · {enc.encounterType.toUpperCase()} · {enc.paymentCategory}
                    </p>
                  </div>
                  <span className="px-2 py-1 rounded text-xs font-semibold bg-green-500/10 text-green-500">
                    {enc.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Patient & Encounter Info */}
        {selectedEncounter && patient && (
          <div className="rounded-lg border bg-card p-6">
            <h2 className="font-semibold text-lg mb-4">Patient Details</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Patient</p>
                <p className="font-semibold">{patient.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">SYNAPSE ID</p>
                <p className="font-semibold">{patient.synapseId}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Visit Type</p>
                <p className="font-semibold">{selectedEncounter.visitType}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Payment Category</p>
                <p className="font-semibold">{selectedEncounter.paymentCategory}</p>
              </div>
            </div>
          </div>
        )}

        {/* Invoice Generation */}
        {selectedEncounter && patient && !invoice && (
          <div className="rounded-lg border bg-card p-6">
            <h2 className="font-semibold text-lg mb-4">Generate Invoice</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Consultation Fee (UGX)</label>
                  <input
                    type="number"
                    value={consultationFee}
                    onChange={(e) => setConsultationFee(e.target.value)}
                    className="w-full px-4 py-2 rounded border bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Laboratory Fees (UGX)</label>
                  <input
                    type="number"
                    value={labFees}
                    onChange={(e) => setLabFees(e.target.value)}
                    className="w-full px-4 py-2 rounded border bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Medication Fees (UGX)</label>
                  <input
                    type="number"
                    value={medicationFees}
                    onChange={(e) => setMedicationFees(e.target.value)}
                    className="w-full px-4 py-2 rounded border bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Other Fees (UGX)</label>
                  <input
                    type="number"
                    value={otherFees}
                    onChange={(e) => setOtherFees(e.target.value)}
                    className="w-full px-4 py-2 rounded border bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Discount (UGX)</label>
                  <input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="w-full px-4 py-2 rounded border bg-background"
                  />
                </div>
              </div>

              <div className="p-4 rounded bg-accent space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Consultation</span>
                  <span className="font-semibold">UGX {(parseFloat(consultationFee) || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Lab</span>
                  <span className="font-semibold">UGX {(parseFloat(labFees) || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Medication</span>
                  <span className="font-semibold">UGX {(parseFloat(medicationFees) || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Total</span>
                  <span>UGX {total.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={handleGenerateInvoice}
                disabled={submitting}
                className="w-full px-6 py-3 rounded bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {submitting ? "Generating..." : "Generate Invoice"}
              </button>
            </div>
          </div>
        )}

        {/* Payment Collection */}
        {invoice && (
          <div className="rounded-lg border bg-card p-6">
            <h2 className="font-semibold text-lg mb-4">Collect Payment</h2>
            
            <div className="space-y-4">
              {/* Invoice Summary */}
              <div className="p-4 rounded bg-accent space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Invoice Number:</span>
                  <span className="font-semibold">{invoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between text-xl font-bold">
                  <span>Amount Due:</span>
                  <span>UGX {invoice.total.toLocaleString()}</span>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-sm font-medium mb-2">Payment Method</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(["cash", "mobile_money", "card", "bank_transfer", "insurance", "government"] as const).map(method => (
                    <button
                      key={method}
                      onClick={() => setPaymentMethod(method)}
                      className={`px-4 py-2 rounded border text-sm font-medium transition-colors ${
                        paymentMethod === method
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:bg-accent"
                      }`}
                    >
                      {method.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Reference */}
              {(paymentMethod === "mobile_money" || paymentMethod === "bank_transfer" || paymentMethod === "card") && (
                <div>
                  <label className="block text-sm font-medium mb-2">Payment Reference (Optional)</label>
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="Transaction ID or reference number"
                    className="w-full px-4 py-2 rounded border bg-background"
                  />
                </div>
              )}

              {!paid ? (
                <button
                  onClick={handlePayment}
                  disabled={submitting}
                  className="demo-btn-primary w-full"
                >
                  {submitting ? "Processing..." : "Record Payment"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCloseVisit}
                  disabled={submitting}
                  className="demo-btn-primary w-full"
                >
                  {submitting ? "Closing..." : "Close Visit"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </DemoShell>
  )
}
