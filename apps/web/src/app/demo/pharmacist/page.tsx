"use client"

import { useState, useEffect } from "react"
import { DemoShell } from "../../../components/demo/DemoShell"
import { DemoEmptyState } from "../../../components/demo/DemoEmptyState"
import { applyStationSession } from "../../../lib/demo/stations"
import {
  getPrescriptionsByFacility,
  getPerson,
  getEncounter,
  getBatchesByItem,
  createDispense,
  appendTimelineEvent,
  appendAuditEvent
} from "../../../lib/demo/browser-repository"

export default function PharmacistDemoPage() {
  const [prescriptions, setPrescriptions] = useState<any[]>([])
  const [selectedRx, setSelectedRx] = useState<any>(null)
  const [patient, setPatient] = useState<any>(null)
  const [encounter, setEncounter] = useState<any>(null)
  const [availableBatches, setAvailableBatches] = useState<any[]>([])
  const [selectedBatch, setSelectedBatch] = useState<any>(null)
  const [quantityToDispense, setQuantityToDispense] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(true)
  const [phase, setPhase] = useState<"review" | "batch" | "dispense">("review")

  useEffect(() => {
    loadPrescriptions()
  }, [])

  useEffect(() => {
    if (selectedRx) {
      loadRxData()
    }
  }, [selectedRx])

  async function loadPrescriptions() {
    try {
      const rxs = await getPrescriptionsByFacility("demo-pharmacy")
      const activeRxs = rxs.filter(rx => rx.status === "active")
      setPrescriptions(activeRxs)
      
      if (activeRxs.length > 0 && !selectedRx) {
        setSelectedRx(activeRxs[0])
      }
    } catch (error) {
      console.error("Failed to load prescriptions:", error)
    } finally {
      setLoading(false)
    }
  }

  async function loadRxData() {
    if (!selectedRx) return

    try {
      const [p, e, batches] = await Promise.all([
        getPerson(selectedRx.personId),
        getEncounter(selectedRx.encounterId),
        getBatchesByItem(selectedRx.medicationId)
      ])

      setPatient(p)
      setEncounter(e)
      
      // Sort batches by expiry date (FEFO - First Expiry, First Out)
      const sortedBatches = batches
        .filter(b => b.quantity > 0)
        .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())
      
      setAvailableBatches(sortedBatches)
      
      if (sortedBatches.length > 0) {
        setSelectedBatch(sortedBatches[0])
      }
      
      setQuantityToDispense(selectedRx.quantity.toString())
    } catch (error) {
      console.error("Failed to load prescription data:", error)
    }
  }

  async function handleDispense() {
    if (!selectedRx || !selectedBatch || !patient || !encounter) return

    const qty = parseInt(quantityToDispense)
    if (isNaN(qty) || qty <= 0 || qty > selectedRx.quantity) {
      alert("Invalid quantity")
      return
    }

    if (qty > selectedBatch.quantity) {
      alert(`Insufficient stock. Available: ${selectedBatch.quantity}`)
      return
    }

    setSubmitting(true)
    try {
      // Create dispense record (also decrements FEFO stock once)
      await createDispense({
        prescriptionId: selectedRx.id,
        encounterId: encounter.id,
        personId: patient.id,
        facilityId: "demo-pharmacy",
        dispensedBy: "pharmacist-demo",
        batchId: selectedBatch.id,
        quantity: qty,
        unitPrice: selectedBatch.salePrice,
        totalPrice: selectedBatch.salePrice * qty,
        dispensedAt: new Date().toISOString()
      })

      // Timeline event
      await appendTimelineEvent({
        personId: patient.id,
        encounterId: encounter.id,
        facilityId: "demo-pharmacy",
        actorId: "pharmacist-demo",
        eventType: "prescription_dispensed",
        title: "Prescription dispensed",
        description: `${selectedRx.medicationName} ${selectedRx.strength} × ${qty}`
      })

      // Audit event
      await appendAuditEvent({
        actorId: "pharmacist-demo",
        actorRole: "pharmacist",
        facilityId: "demo-pharmacy",
        action: "prescription.dispense",
        entityType: "prescription",
        entityId: selectedRx.id,
        personId: patient.id,
        encounterId: encounter.id
      })

      setSuccess(true)
    } catch (error) {
      console.error("Failed to dispense:", error)
      alert("Failed to dispense. Check console for details.")
    } finally {
      setSubmitting(false)
    }
  }

  function resetForm() {
    setSuccess(false)
    setSelectedRx(null)
    setPatient(null)
    setEncounter(null)
    setAvailableBatches([])
    setSelectedBatch(null)
    setQuantityToDispense("")
    loadPrescriptions()
  }

  if (loading) {
    return (
      <DemoShell title="Pharmacy" description="Review the incoming prescription, pick the FEFO batch, dispense." requiresRole={["pharmacist", "admin"]}>
        <div className="demo-card h-24" aria-hidden="true" />
      </DemoShell>
    )
  }

  if (success) {
    return (
      <DemoShell title="Pharmacy" requiresRole={["pharmacist", "admin"]}>
        <div className="rounded-lg border bg-card p-8 text-center space-y-4">
          <div className="text-6xl">✅</div>
          <h2 className="text-2xl font-bold">Prescription Dispensed</h2>
          <div className="space-y-2 text-left max-w-md mx-auto">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Patient:</span>
              <span className="font-medium">{patient?.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Medication:</span>
              <span className="font-medium">{selectedRx?.medicationName} {selectedRx?.strength}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Quantity:</span>
              <span className="font-medium">{quantityToDispense}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Batch:</span>
              <span className="font-medium">{selectedBatch?.batchNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-medium">UGX {(selectedBatch?.salePrice || 0) * parseInt(quantityToDispense)}</span>
            </div>
          </div>
          <div className="pt-4">
            <a
              className="demo-btn-primary"
              href="/demo/billing"
              onClick={() => applyStationSession("billing")}
            >
              Continue as Billing
            </a>
          </div>
        </div>
      </DemoShell>
    )
  }

  if (prescriptions.length === 0) {
    return (
      <DemoShell title="Pharmacy" description="Review the incoming prescription, pick the FEFO batch, dispense." requiresRole={["pharmacist", "admin"]}>
        <DemoEmptyState
          title="No prescriptions waiting"
          body="Continue as Doctor to prescribe for the synthetic patient."
          primaryLabel="Continue as Doctor to prescribe"
          primaryStation="doctor"
        />
      </DemoShell>
    )
  }

  return (
    <DemoShell title="Pharmacy" requiresRole={["pharmacist", "admin"]}>
      <div className="space-y-6">
        {/* Prescription Queue */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="font-semibold text-lg mb-4">Prescription Queue ({prescriptions.length})</h2>
          <div className="space-y-2">
            {prescriptions.map(rx => (
              <button
                key={rx.id}
                onClick={() => setSelectedRx(rx)}
                className={`w-full p-4 rounded border text-left transition-colors ${
                  selectedRx?.id === rx.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-accent"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-semibold">{rx.medicationName} {rx.strength}</p>
                    <p className="text-sm text-muted-foreground">
                      {rx.form} · {rx.quantity} × {rx.frequency} for {rx.duration}
                    </p>
                  </div>
                  <span className="px-2 py-1 rounded text-xs font-semibold bg-orange-500/10 text-orange-500">
                    {rx.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Prescription Details */}
        {selectedRx && patient && encounter && (
          <div className="space-y-6">
            {/* Patient Info */}
            <div className="rounded-lg border bg-card p-6">
              <h2 className="font-semibold text-lg mb-4">Patient & Prescription Details</h2>
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
                  <p className="text-muted-foreground">Age / Sex</p>
                  <p className="font-semibold">
                    {patient.dateOfBirth ? new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear() : "?"} · {patient.sex}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Prescribed By</p>
                  <p className="font-semibold">{selectedRx.prescribedBy}</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t">
                <h3 className="font-semibold mb-3">Prescription</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Medication</p>
                    <p className="font-semibold">{selectedRx.medicationName} {selectedRx.strength}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Form</p>
                    <p className="font-semibold">{selectedRx.form}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Dose</p>
                    <p className="font-semibold">{selectedRx.dose}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Route</p>
                    <p className="font-semibold">{selectedRx.route}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Frequency</p>
                    <p className="font-semibold">{selectedRx.frequency}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Duration</p>
                    <p className="font-semibold">{selectedRx.duration}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Quantity</p>
                    <p className="font-semibold">{selectedRx.quantity}</p>
                  </div>
                  {selectedRx.instructions && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Instructions</p>
                      <p className="font-semibold">{selectedRx.instructions}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

              {phase === "review" ? (
                <button type="button" className="demo-btn-primary w-full" onClick={() => setPhase("batch")}>
                  Review Prescription
                </button>
              ) : null}

            {phase !== "review" ? (
              <>
            <div className="rounded-lg border bg-card p-6">
              <h2 className="font-semibold text-lg mb-2">Select FEFO batch</h2>
              <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>First expiry, first out. Earliest expiry is recommended.</p>
              
              {availableBatches.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <p className="font-semibold" style={{ color: "var(--danger, #b91c1c)" }}>Out of Stock</p>
                  <p className="text-sm mt-2">No available batches for this medication</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {availableBatches.map(batch => {
                    const daysToExpiry = Math.floor((new Date(batch.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                    const isExpiringSoon = daysToExpiry < 90
                    
                    return (
                      <button
                        key={batch.id}
                        type="button"
                        onClick={() => setSelectedBatch(batch)}
                        className={`w-full p-4 rounded border text-left transition-colors ${
                          selectedBatch?.id === batch.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-accent"
                        } ${isExpiringSoon ? "border-orange-500/50" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold">{batch.batchNumber}</p>
                              {batch.id === availableBatches[0]?.id && (
                                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-500/10 text-green-500">
                                  FEFO First
                                </span>
                              )}
                              {isExpiringSoon && (
                                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-orange-500/10 text-orange-500">
                                  Expiring Soon
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm text-muted-foreground">
                              <div>Qty: <span className="font-semibold text-foreground">{batch.quantity}</span></div>
                              <div>Expiry: <span className="font-semibold text-foreground">{new Date(batch.expiryDate).toLocaleDateString()}</span></div>
                              <div>Days: <span className={`font-semibold ${isExpiringSoon ? "text-orange-500" : "text-foreground"}`}>{daysToExpiry}</span></div>
                              <div>Price: <span className="font-semibold text-foreground">UGX {batch.salePrice}</span></div>
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
              {phase === "batch" && selectedBatch ? (
                <button type="button" className="demo-btn-primary mt-4 w-full" onClick={() => setPhase("dispense")}>
                  Select Batch
                </button>
              ) : null}
            </div>

            {selectedBatch && phase === "dispense" ? (
              <div className="rounded-lg border bg-card p-6">
                <h2 className="font-semibold text-lg mb-4">Dispense</h2>
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="dispense-qty" className="block text-sm font-medium mb-2">Quantity to Dispense</label>
                    <input
                      id="dispense-qty"
                      type="number"
                      value={quantityToDispense}
                      onChange={(e) => setQuantityToDispense(e.target.value)}
                      min="1"
                      max={Math.min(selectedRx.quantity, selectedBatch.quantity)}
                      className="w-full px-4 py-2 rounded border bg-background"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Prescribed: {selectedRx.quantity} · Available: {selectedBatch.quantity}
                    </p>
                  </div>

                  <div className="p-4 rounded bg-accent">
                    <div className="flex justify-between text-sm mb-2">
                      <span>Unit Price:</span>
                      <span className="font-semibold">UGX {selectedBatch.salePrice}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total:</span>
                      <span>UGX {(selectedBatch.salePrice * parseInt(quantityToDispense || "0")).toLocaleString()}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleDispense}
                    disabled={submitting || !quantityToDispense || parseInt(quantityToDispense) <= 0}
                    className="demo-btn-primary w-full"
                  >
                    {submitting ? "Dispensing..." : "Dispense"}
                  </button>
                </div>
              </div>
            ) : null}
              </>
            ) : null}
          </div>
        )}
      </div>
    </DemoShell>
  )
}
