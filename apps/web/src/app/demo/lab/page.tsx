"use client"

import { useState, useEffect } from "react"
import { DemoShell } from "../../../components/demo/DemoShell"
import { DemoEmptyState } from "../../../components/demo/DemoEmptyState"
import { applyStationSession } from "../../../lib/demo/stations"
import {
  getOrdersByFacility,
  getPerson,
  getEncounter,
  updateOrder,
  createSpecimen,
  getSpecimens,
  createLabResult,
  updateLabResult,
  getLabResultsByOrder,
  appendTimelineEvent,
  appendAuditEvent,
  createExchangeEvent,
  createNotification
} from "../../../lib/demo/browser-repository"

type OrderStatus = "ordered" | "acknowledged" | "collected" | "processing" | "verified" | "released" | "cancelled"

export default function LabDemoPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [patient, setPatient] = useState<any>(null)
  const [encounter, setEncounter] = useState<any>(null)
  const [specimen, setSpecimen] = useState<any>(null)
  const [results, setResults] = useState<any[]>([])
  const [role, setRole] = useState<string>("")

  // Specimen collection
  const [accessionNumber, setAccessionNumber] = useState("")
  const [specimenType, setSpecimenType] = useState("Blood")
  const [collectedBy, setCollectedBy] = useState("lab-tech-demo")

  // Result entry
  const [resultValue, setResultValue] = useState("")
  const [resultUnit, setResultUnit] = useState("")
  const [interpretation, setInterpretation] = useState<"normal" | "high" | "low" | "critical">("normal")

  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRole()
    loadOrders()
  }, [])

  useEffect(() => {
    if (selectedOrder) {
      loadOrderData()
    }
  }, [selectedOrder])

  async function loadRole() {
    const storedRole = sessionStorage.getItem("synapse_demo_role") || "lab_technician"
    setRole(storedRole)
  }

  async function loadOrders() {
    try {
      const allOrders = await getOrdersByFacility("demo-lab")
      setOrders(allOrders.filter(o => o.orderType === "lab"))
      
      if (allOrders.length > 0 && !selectedOrder) {
        setSelectedOrder(allOrders[0])
      }
    } catch (error) {
      console.error("Failed to load orders:", error)
    } finally {
      setLoading(false)
    }
  }

  async function loadOrderData() {
    if (!selectedOrder) return

    try {
      const [p, e, specs, res] = await Promise.all([
        getPerson(selectedOrder.personId),
        getEncounter(selectedOrder.encounterId),
        getSpecimens(),
        getLabResultsByOrder(selectedOrder.id)
      ])

      setPatient(p)
      setEncounter(e)
      setResults(res)

      const spec = specs.find(s => s.orderId === selectedOrder.id)
      setSpecimen(spec)

      if (spec) {
        setAccessionNumber(spec.accessionNumber)
        setSpecimenType(spec.specimenType)
      } else {
        setAccessionNumber(`ACC-${Date.now().toString().slice(-8)}`)
      }
    } catch (error) {
      console.error("Failed to load order data:", error)
    }
  }

  async function handleAcceptOrder() {
    if (!selectedOrder) return

    setSubmitting(true)
    try {
      await updateOrder(selectedOrder.id, { status: "acknowledged" })

      await appendTimelineEvent({
        personId: selectedOrder.personId,
        encounterId: selectedOrder.encounterId,
        facilityId: "demo-lab",
        actorId: collectedBy,
        eventType: "lab_order_acknowledged",
        title: "Lab order acknowledged",
        description: selectedOrder.testName
      })

      await appendAuditEvent({
        actorId: collectedBy,
        actorRole: role,
        facilityId: "demo-lab",
        action: "lab_order.acknowledge",
        entityType: "order",
        entityId: selectedOrder.id,
        personId: selectedOrder.personId,
        encounterId: selectedOrder.encounterId
      })

      setSelectedOrder({ ...selectedOrder, status: "acknowledged" })
      await loadOrders()
    } catch (error) {
      console.error("Failed to acknowledge order:", error)
      alert("Failed to acknowledge order")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCollectSpecimen() {
    if (!selectedOrder || !accessionNumber) return

    setSubmitting(true)
    try {
      const spec = await createSpecimen({
        orderId: selectedOrder.id,
        encounterId: selectedOrder.encounterId,
        personId: selectedOrder.personId,
        facilityId: "demo-lab",
        specimenType,
        collectedBy,
        collectedAt: new Date().toISOString(),
        accessionNumber,
        status: "collected"
      })

      await updateOrder(selectedOrder.id, { status: "collected" })

      await appendTimelineEvent({
        personId: selectedOrder.personId,
        encounterId: selectedOrder.encounterId,
        facilityId: "demo-lab",
        actorId: collectedBy,
        eventType: "specimen_collected",
        title: "Specimen collected",
        description: `${specimenType} · Accession: ${accessionNumber}`
      })

      setSpecimen(spec)
      setSelectedOrder({ ...selectedOrder, status: "collected" })
      await loadOrders()
    } catch (error) {
      console.error("Failed to collect specimen:", error)
      alert("Failed to collect specimen")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEnterResult() {
    if (!selectedOrder || !resultValue) return

    setSubmitting(true)
    try {
      const result = await createLabResult({
        orderId: selectedOrder.id,
        encounterId: selectedOrder.encounterId,
        personId: selectedOrder.personId,
        facilityId: "demo-lab",
        testCode: selectedOrder.testCode,
        testName: selectedOrder.testName,
        value: resultValue,
        unit: resultUnit || undefined,
        interpretation,
        enteredBy: collectedBy,
        status: "entered"
      })

      await updateOrder(selectedOrder.id, { status: "processing" })

      await appendTimelineEvent({
        personId: selectedOrder.personId,
        encounterId: selectedOrder.encounterId,
        facilityId: "demo-lab",
        actorId: collectedBy,
        eventType: "lab_result_entered",
        title: "Result entered",
        description: `${selectedOrder.testName}: ${resultValue} ${resultUnit || ""}`
      })

      setResults([...results, result])
      setResultValue("")
      setResultUnit("")
      setSelectedOrder({ ...selectedOrder, status: "processing" })
      await loadOrders()
    } catch (error) {
      console.error("Failed to enter result:", error)
      alert("Failed to enter result")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleVerifyResults() {
    if (!selectedOrder || results.length === 0) return

    setSubmitting(true)
    try {
      for (const result of results) {
        if (result.status === "entered") {
          await updateLabResult(result.id, {
            verifiedBy: "lab-scientist-demo",
            verifiedAt: new Date().toISOString(),
            status: "verified"
          })
        }
      }

      await updateOrder(selectedOrder.id, { status: "verified" })

      await appendTimelineEvent({
        personId: selectedOrder.personId,
        encounterId: selectedOrder.encounterId,
        facilityId: "demo-lab",
        actorId: "lab-scientist-demo",
        eventType: "lab_results_verified",
        title: "Results verified",
        description: selectedOrder.testName
      })

      setSelectedOrder({ ...selectedOrder, status: "verified" })
      await loadOrderData()
      await loadOrders()
    } catch (error) {
      console.error("Failed to verify results:", error)
      alert("Failed to verify results")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleReleaseResults() {
    if (!selectedOrder || results.length === 0) return

    setSubmitting(true)
    try {
      for (const result of results) {
        if (result.status === "verified") {
          await updateLabResult(result.id, {
            releasedBy: "lab-scientist-demo",
            releasedAt: new Date().toISOString(),
            status: "released"
          })
        }
      }

      await updateOrder(selectedOrder.id, { status: "released" })
      await createExchangeEvent({
        type: "lab_result",
        personId: selectedOrder.personId,
        encounterId: selectedOrder.encounterId,
        sourceFacilityId: "demo-lab",
        destinationFacilityId: selectedOrder.sourceFacilityId,
        actorId: "lab-scientist-demo",
        payload: { order: selectedOrder, results },
        status: "delivered"
      })

      await appendTimelineEvent({
        personId: selectedOrder.personId,
        encounterId: selectedOrder.encounterId,
        facilityId: "demo-lab",
        actorId: "lab-scientist-demo",
        eventType: "lab_results_released",
        title: "Results released",
        description: selectedOrder.testName
      })

      // Notify doctor
      await createNotification({
        userId: "doctor-demo",
        facilityId: selectedOrder.sourceFacilityId,
        type: "result",
        title: "Lab results available",
        message: `${patient?.name} - ${selectedOrder.testName}`,
        read: false,
        relatedEntityId: selectedOrder.id,
        relatedEntityType: "order"
      })

      await loadOrderData()
      await loadOrders()
      setSelectedOrder({ ...selectedOrder, status: "released" })
    } catch (error) {
      console.error("Failed to release results:", error)
      alert("Failed to release results")
    } finally {
      setSubmitting(false)
    }
  }

  const canAccept = selectedOrder?.status === "ordered"
  const canCollect = selectedOrder?.status === "acknowledged" && !specimen
  const canEnterResults = selectedOrder?.status === "collected" || selectedOrder?.status === "processing"
  const canVerify = role === "lab_scientist" && selectedOrder?.status === "processing" && results.some(r => r.status === "entered")
  const canRelease = role === "lab_scientist" && selectedOrder?.status === "verified" && results.some(r => r.status === "verified")

  const statusColor = {
    ordered: "bg-blue-500/10 text-blue-500",
    acknowledged: "bg-purple-500/10 text-purple-500",
    collected: "bg-yellow-500/10 text-yellow-500",
    processing: "bg-orange-500/10 text-orange-500",
    verified: "bg-green-500/10 text-green-500",
    released: "bg-gray-500/10 text-gray-500",
    cancelled: "bg-red-500/10 text-red-500"
  }

  const statusLabel: Record<OrderStatus, string> = {
    ordered: "New",
    acknowledged: "New",
    collected: "Collected",
    processing: "Processing",
    verified: "Verification",
    released: "Released",
    cancelled: "Cancelled"
  }

  if (loading) {
    return (
      <DemoShell title="Lab Worklist" description="Accept, collect, enter, then verify and release." requiresRole={["lab_technician", "lab_scientist", "admin"]}>
        <div className="demo-card h-24" aria-hidden="true" />
      </DemoShell>
    )
  }

  if (orders.length === 0) {
    return (
      <DemoShell title="Lab Worklist" description="Accept, collect, enter, then verify and release." requiresRole={["lab_technician", "lab_scientist", "admin"]}>
        <DemoEmptyState
          title="No Lab orders"
          body="Continue as Doctor to order tests for the synthetic patient."
          primaryLabel="Continue as Doctor to order tests"
          primaryStation="doctor"
        />
      </DemoShell>
    )
  }

  return (
    <DemoShell title="Lab Worklist" requiresRole={["lab_technician", "lab_scientist", "admin"]}>
      <div className="space-y-6">
        {/* Order List */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="font-semibold text-lg mb-4">Lab Orders ({orders.length})</h2>
          <div className="space-y-2">
            {orders.map(order => (
              <button
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className={`w-full p-4 rounded border text-left transition-colors ${
                  selectedOrder?.id === order.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-accent"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-semibold">{order.testName}</p>
                    <p className="text-sm text-muted-foreground">
                      From {order.sourceFacilityId} · {order.priority}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${statusColor[order.status as OrderStatus]}`}>
                    {statusLabel[order.status as OrderStatus]}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Order Details */}
        {selectedOrder && patient && encounter && (
          <div className="space-y-6">
            {/* Patient Info */}
            <div className="rounded-lg border bg-card p-6">
              <h2 className="font-semibold text-lg mb-4">Patient & Order Details</h2>
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
                  <p className="text-muted-foreground">Status</p>
                  <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${statusColor[selectedOrder.status as OrderStatus]}`}>
                    {selectedOrder.status}
                  </span>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Test</p>
                  <p className="font-semibold">{selectedOrder.testName}</p>
                  <p className="text-xs text-muted-foreground">Code: {selectedOrder.testCode}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Priority</p>
                  <p className="font-semibold">{selectedOrder.priority.toUpperCase()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Ordered By</p>
                  <p className="font-semibold">{selectedOrder.orderedBy}</p>
                </div>
                {selectedOrder.clinicalQuestion && (
                  <div className="col-span-4">
                    <p className="text-muted-foreground">Clinical Question</p>
                    <p className="font-semibold">{selectedOrder.clinicalQuestion}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Workflow Actions */}
            <div className="rounded-lg border bg-card p-6">
              <h2 className="font-semibold text-lg mb-4">Lab Workflow</h2>

              {/* Accept Order */}
              {canAccept && (
                <div className="space-y-3 p-4 rounded border bg-background">
                  <h3 className="font-medium">Step 1: Accept Order</h3>
                  <button
                    onClick={handleAcceptOrder}
                    disabled={submitting}
                    className="w-full px-6 py-3 rounded bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {submitting ? "Accepting..." : "Accept Order"}
                  </button>
                </div>
              )}

              {/* Collect Specimen */}
              {canCollect && (
                <div className="space-y-3 p-4 rounded border bg-background mt-4">
                  <h3 className="font-medium">Step 2: Collect Specimen</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Accession Number</label>
                      <input
                        type="text"
                        value={accessionNumber}
                        onChange={(e) => setAccessionNumber(e.target.value)}
                        className="w-full px-3 py-2 rounded border bg-background"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Specimen Type</label>
                      <select
                        value={specimenType}
                        onChange={(e) => setSpecimenType(e.target.value)}
                        className="w-full px-3 py-2 rounded border bg-background"
                      >
                        <option value="Blood">Blood</option>
                        <option value="Urine">Urine</option>
                        <option value="Serum">Serum</option>
                        <option value="Plasma">Plasma</option>
                        <option value="Swab">Swab</option>
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={handleCollectSpecimen}
                    disabled={submitting || !accessionNumber}
                    className="w-full px-6 py-3 rounded bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {submitting ? "Collecting..." : "Collect Specimen"}
                  </button>
                </div>
              )}

              {/* Specimen Info */}
              {specimen && (
                <div className="p-4 rounded border bg-green-500/10 border-green-500/20 mt-4">
                  <h3 className="font-medium mb-2">✓ Specimen Collected</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Accession</p>
                      <p className="font-semibold">{specimen.accessionNumber}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Type</p>
                      <p className="font-semibold">{specimen.specimenType}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Collected By</p>
                      <p className="font-semibold">{specimen.collectedBy}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      <p className="font-semibold">{specimen.status}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Enter Results */}
              {canEnterResults && (
                <div className="space-y-3 p-4 rounded border bg-background mt-4">
                  <h3 className="font-medium">Step 3: Enter Results</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label htmlFor="lab-result-value" className="block text-sm font-medium mb-1">Result Value *</label>
                      <input
                        id="lab-result-value"
                        type="text"
                        value={resultValue}
                        onChange={(e) => setResultValue(e.target.value)}
                        placeholder="e.g. 12.5"
                        className="w-full px-3 py-2 rounded border bg-background"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Unit</label>
                      <input
                        type="text"
                        value={resultUnit}
                        onChange={(e) => setResultUnit(e.target.value)}
                        placeholder="e.g. g/dL"
                        className="w-full px-3 py-2 rounded border bg-background"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Interpretation</label>
                      <select
                        value={interpretation}
                        onChange={(e) => setInterpretation(e.target.value as any)}
                        className="w-full px-3 py-2 rounded border bg-background"
                      >
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="low">Low</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                  </div>
                  <button
                    onClick={handleEnterResult}
                    disabled={submitting || !resultValue}
                    className="w-full px-6 py-3 rounded bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {submitting ? "Entering..." : "Enter Result"}
                  </button>
                </div>
              )}

              {role !== "lab_scientist" && results.some((row) => row.status === "entered" || row.status === "verified") && selectedOrder.status !== "released" ? (
                <div className="mt-4">
                  <a className="demo-btn-primary w-full" href="/demo/lab" onClick={() => {
                    sessionStorage.setItem("synapse_demo_role", "lab_scientist")
                    sessionStorage.setItem("synapse_demo_facility", "demo-lab")
                    sessionStorage.setItem("synapse_demo_mode", "true")
                  }}>
                    Continue as Lab Scientist
                  </a>
                </div>
              ) : null}

              {/* Results Display */}
              {results.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h3 className="font-medium">Entered Results</h3>
                  {results.map((result, idx) => (
                    <div key={idx} className="p-3 rounded border bg-background flex items-center justify-between">
                      <div>
                        <p className="font-medium">{result.testName}</p>
                        <p className="text-sm">
                          <span className="font-semibold">{result.value}</span>
                          {result.unit && <span className="text-muted-foreground"> {result.unit}</span>}
                          <span className={`ml-2 px-2 py-0.5 rounded text-xs font-semibold ${
                            result.interpretation === "critical" ? "bg-red-500/10 text-red-500" :
                            result.interpretation === "high" || result.interpretation === "low" ? "bg-yellow-500/10 text-yellow-500" :
                            "bg-green-500/10 text-green-500"
                          }`}>
                            {result.interpretation}
                          </span>
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">{result.status}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Verify Results (Lab Scientist only) */}
              {canVerify && (
                <div className="mt-4 p-4 rounded border bg-background">
                  <h3 className="font-medium mb-2">Step 4: Verify Results</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Lab Scientist: Review and verify entered results
                  </p>
                  <button
                    onClick={handleVerifyResults}
                    disabled={submitting}
                    className="w-full px-6 py-3 rounded bg-green-500 text-white font-semibold hover:bg-green-600 transition-colors disabled:opacity-50"
                  >
                    {submitting ? "Verifying..." : "✓ Verify Results"}
                  </button>
                </div>
              )}

              {/* Release Results (Lab Scientist only) */}
              {canRelease && (
                <div className="mt-4 p-4 rounded border bg-background">
                  <h3 className="font-medium mb-2">Step 5: Release Results</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Lab Scientist: Release verified results to ordering facility
                  </p>
                  <button
                    onClick={handleReleaseResults}
                    disabled={submitting}
                    className="w-full px-6 py-3 rounded bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {submitting ? "Releasing..." : "Verify & Release"}
                  </button>
                </div>
              )}

              {/* Completed */}
              {selectedOrder.status === "released" && (
                <div className="mt-4 p-6 rounded-lg border bg-card text-center space-y-3">
                  <h3 className="font-bold">Results Released</h3>
                  <p className="text-sm text-muted-foreground">
                    Results have been sent to Demo Hospital.
                  </p>
                  <a className="demo-btn-primary" href="/demo/doctor?stage=review" onClick={() => applyStationSession("review")}>
                    Continue as Doctor
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DemoShell>
  )
}
