"use client"

import { useState, useEffect } from "react"
import { DemoShell } from "../../../components/demo/DemoShell"
import { DemoEmptyState } from "../../../components/demo/DemoEmptyState"
import { applyStationSession } from "../../../lib/demo/stations"
import {
  getQueue,
  getPerson,
  getPersons,
  getEncounter,
  getTriage,
  recordTriage,
  queuePatient,
  appendTimelineEvent,
  appendAuditEvent,
  createNotification
} from "../../../lib/demo/browser-repository"

export default function NurseDemoPage() {
  const [queueItems, setQueueItems] = useState<any[]>([])
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [patient, setPatient] = useState<any>(null)
  const [encounter, setEncounter] = useState<any>(null)
  const [existingTriage, setExistingTriage] = useState<any>(null)

  // Vitals state
  const [temperatureC, setTemperatureC] = useState("")
  const [heartRate, setHeartRate] = useState("")
  const [bpSystolic, setBpSystolic] = useState("")
  const [bpDiastolic, setBpDiastolic] = useState("")
  const [respiratoryRate, setRespiratoryRate] = useState("")
  const [spo2, setSpo2] = useState("")
  const [weightKg, setWeightKg] = useState("")
  const [heightCm, setHeightCm] = useState("")
  const [painScore, setPainScore] = useState("")
  const [triageCategory, setTriageCategory] = useState<"red" | "orange" | "yellow" | "green">("green")
  const [notes, setNotes] = useState("")

  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    loadQueue()
  }, [])

  useEffect(() => {
    if (selectedItem) {
      loadPatientData()
    }
  }, [selectedItem])

  async function loadQueue() {
    const queue = await getQueue()
    const persons = await getPersons()
    const triageQueue = queue
      .filter(q => q.queueType === "triage" && q.status === "waiting")
      .map((item) => ({ ...item, personName: persons.find((p) => p.id === item.personId)?.name || "Patient" }))
    setQueueItems(triageQueue)

    if (triageQueue.length > 0 && !selectedItem) {
      setSelectedItem(triageQueue[0])
    }
  }

  async function loadPatientData() {
    if (!selectedItem) return

    const [p, e, t] = await Promise.all([
      getPerson(selectedItem.personId),
      getEncounter(selectedItem.encounterId),
      getTriage(selectedItem.encounterId)
    ])

    setPatient(p)
    setEncounter(e)
    setExistingTriage(t)

    // Load existing vitals if available
    if (t) {
      setTemperatureC(t.temperatureC?.toString() || "")
      setHeartRate(t.heartRate?.toString() || "")
      setBpSystolic(t.bpSystolic?.toString() || "")
      setBpDiastolic(t.bpDiastolic?.toString() || "")
      setRespiratoryRate(t.respiratoryRate?.toString() || "")
      setSpo2(t.spo2?.toString() || "")
      setWeightKg(t.weightKg?.toString() || "")
      setHeightCm(t.heightCm?.toString() || "")
      setPainScore(t.painScore?.toString() || "")
      setTriageCategory(t.triageCategory)
      setNotes(t.notes || "")
    }
  }

  async function handleSaveTriage() {
    if (!selectedItem || !patient || !encounter) {
      alert("No patient selected")
      return
    }

    setSubmitting(true)
    try {
      // Record triage
      const triage = await recordTriage({
        encounterId: encounter.id,
        personId: patient.id,
        facilityId: "demo-hospital",
        recordedBy: "nurse-demo",
        temperatureC: temperatureC ? parseFloat(temperatureC) : undefined,
        heartRate: heartRate ? parseInt(heartRate) : undefined,
        bpSystolic: bpSystolic ? parseInt(bpSystolic) : undefined,
        bpDiastolic: bpDiastolic ? parseInt(bpDiastolic) : undefined,
        respiratoryRate: respiratoryRate ? parseInt(respiratoryRate) : undefined,
        spo2: spo2 ? parseInt(spo2) : undefined,
        weightKg: weightKg ? parseFloat(weightKg) : undefined,
        heightCm: heightCm ? parseFloat(heightCm) : undefined,
        painScore: painScore ? parseInt(painScore) : undefined,
        triageCategory,
        notes: notes.trim() || undefined
      })

      // Add to doctor queue
      await queuePatient({
        encounterId: encounter.id,
        personId: patient.id,
        facilityId: "demo-hospital",
        queueType: "doctor",
        priority: triageCategory === "red" ? "emergency" : triageCategory === "orange" ? "urgent" : "routine",
        status: "waiting",
        position: 1
      })

      // Timeline event
      await appendTimelineEvent({
        personId: patient.id,
        encounterId: encounter.id,
        facilityId: "demo-hospital",
        actorId: "nurse-demo",
        eventType: "triage_recorded",
        title: `Triage completed: ${triageCategory.toUpperCase()}`,
        description: `Vitals recorded · Category: ${triageCategory.toUpperCase()}`
      })

      // Audit event
      await appendAuditEvent({
        actorId: "nurse-demo",
        actorRole: "nurse",
        facilityId: "demo-hospital",
        action: "triage.record",
        entityType: "triage",
        entityId: triage.id,
        personId: patient.id,
        encounterId: encounter.id,
        after: triage
      })

      // Notify doctor if urgent/emergency
      if (triageCategory === "red" || triageCategory === "orange") {
        await createNotification({
          userId: "doctor-demo",
          facilityId: "demo-hospital",
          type: "queue",
          title: `${triageCategory === "red" ? "🚨 EMERGENCY" : "⚠️ URGENT"} Patient`,
          message: `${patient.name} - ${encounter.complaint}`,
          read: false,
          relatedEntityId: encounter.id,
          relatedEntityType: "encounter"
        })
      }

      setSuccess(true)
    } catch (error) {
      console.error("Failed to save triage:", error)
      alert("Failed to save triage. Check console for details.")
    } finally {
      setSubmitting(false)
    }
  }

  function resetForm() {
    setSuccess(false)
    setSelectedItem(null)
    setPatient(null)
    setEncounter(null)
    setExistingTriage(null)
    setTemperatureC("")
    setHeartRate("")
    setBpSystolic("")
    setBpDiastolic("")
    setRespiratoryRate("")
    setSpo2("")
    setWeightKg("")
    setHeightCm("")
    setPainScore("")
    setTriageCategory("green")
    setNotes("")
    loadQueue()
  }

  if (success) {
    return (
      <DemoShell title="Nurse Station" requiresRole={["nurse", "admin"]}>
        <div className="rounded-lg border bg-card p-8 text-center space-y-4">
          <div className="text-6xl">✅</div>
          <h2 className="text-2xl font-bold">Triage Completed</h2>
          <div className="space-y-2 text-left max-w-md mx-auto">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Patient:</span>
              <span className="font-medium">{patient?.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Category:</span>
              <span className={`font-bold ${
                triageCategory === "red" ? "text-red-500" :
                triageCategory === "orange" ? "text-orange-500" :
                triageCategory === "yellow" ? "text-yellow-500" :
                "text-green-500"
              }`}>
                {triageCategory.toUpperCase()}
              </span>
            </div>
          </div>
          <div className="pt-4 space-y-3">
            <p className="text-sm text-muted-foreground">Patient sent to Doctor queue</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={resetForm}
                className="px-4 py-2 rounded bg-secondary hover:bg-secondary/80 transition-colors"
              >
                Next Patient
              </button>
              <a
                className="demo-btn-primary"
                href="/demo/doctor"
                onClick={() => applyStationSession("doctor")}
              >
                Continue as Doctor
              </a>
            </div>
          </div>
        </div>
      </DemoShell>
    )
  }

  return (
    <DemoShell title="Nurse Station" requiresRole={["nurse", "admin"]}>
      <div className="space-y-6">
        {/* Queue */}
        {queueItems.length > 0 && (
          <div className="rounded-lg border bg-card p-6">
            <h2 className="font-semibold text-lg mb-4">Triage Queue ({queueItems.length})</h2>
            <div className="space-y-2">
              {queueItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={`w-full p-4 rounded border text-left transition-colors ${
                    selectedItem?.id === item.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{item.personName || "Patient"}</p>
                      <p className="text-sm text-muted-foreground">
                        Priority: {item.priority} · Position: {item.position}
                      </p>
                    </div>
                    {selectedItem?.id === item.id && (
                      <span className="text-primary text-xl">✓</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {queueItems.length === 0 && (
          <DemoEmptyState
            title="No patients waiting for triage"
            body="Start a visit at Reception so Amina appears in this queue."
            primaryLabel="Start a visit at Reception"
            primaryStation="reception"
          />
        )}

        {/* Patient Info */}
        {patient && encounter && (
          <div className="rounded-lg border bg-card p-6">
            <h2 className="font-semibold text-lg mb-4">Patient Information</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Name</p>
                <p className="font-semibold">{patient.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">SYNAPSE ID</p>
                <p className="font-semibold">{patient.synapseId}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Age / Sex</p>
                <p className="font-semibold">
                  {patient.dateOfBirth ? new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear() : "?"} years · {patient.sex}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Phone</p>
                <p className="font-semibold">{patient.phone || "N/A"}</p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">Chief Complaint</p>
                <p className="font-semibold">{encounter.complaint}</p>
              </div>
            </div>
          </div>
        )}

        {/* Vitals Form */}
        {selectedItem && patient && encounter && (
          <div className="rounded-lg border bg-card p-6">
            <h2 className="font-semibold text-lg mb-4">Record Vitals & Triage</h2>
            
            <div className="space-y-6">
              {/* Vital Signs */}
              <div>
                <h3 className="font-medium mb-3">Vital Signs</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="vitals-temp" className="block text-sm font-medium mb-1">Temperature (°C)</label>
                    <input
                      id="vitals-temp"
                      type="number"
                      step="0.1"
                      value={temperatureC}
                      onChange={(e) => setTemperatureC(e.target.value)}
                      placeholder="37.0"
                      className="w-full px-3 py-2 rounded border bg-background"
                    />
                  </div>
                  <div>
                    <label htmlFor="vitals-hr" className="block text-sm font-medium mb-1">Heart Rate (bpm)</label>
                    <input
                      id="vitals-hr"
                      type="number"
                      value={heartRate}
                      onChange={(e) => setHeartRate(e.target.value)}
                      placeholder="80"
                      className="w-full px-3 py-2 rounded border bg-background"
                    />
                  </div>
                  <div>
                    <label htmlFor="vitals-sys" className="block text-sm font-medium mb-1">BP Systolic (mmHg)</label>
                    <input
                      id="vitals-sys"
                      type="number"
                      value={bpSystolic}
                      onChange={(e) => setBpSystolic(e.target.value)}
                      placeholder="120"
                      className="w-full px-3 py-2 rounded border bg-background"
                    />
                  </div>
                  <div>
                    <label htmlFor="vitals-dia" className="block text-sm font-medium mb-1">BP Diastolic (mmHg)</label>
                    <input
                      id="vitals-dia"
                      type="number"
                      value={bpDiastolic}
                      onChange={(e) => setBpDiastolic(e.target.value)}
                      placeholder="80"
                      className="w-full px-3 py-2 rounded border bg-background"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Respiratory Rate</label>
                    <input
                      type="number"
                      value={respiratoryRate}
                      onChange={(e) => setRespiratoryRate(e.target.value)}
                      placeholder="16"
                      className="w-full px-3 py-2 rounded border bg-background"
                    />
                  </div>
                  <div>
                    <label htmlFor="vitals-spo2" className="block text-sm font-medium mb-1">SpO₂ (%)</label>
                    <input
                      id="vitals-spo2"
                      type="number"
                      value={spo2}
                      onChange={(e) => setSpo2(e.target.value)}
                      placeholder="98"
                      className="w-full px-3 py-2 rounded border bg-background"
                    />
                  </div>
                </div>
              </div>

              {/* Anthropometric */}
              <div>
                <h3 className="font-medium mb-3">Anthropometric</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Weight (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      placeholder="70"
                      className="w-full px-3 py-2 rounded border bg-background"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Height (cm)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={heightCm}
                      onChange={(e) => setHeightCm(e.target.value)}
                      placeholder="170"
                      className="w-full px-3 py-2 rounded border bg-background"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Pain Score (0-10)</label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={painScore}
                      onChange={(e) => setPainScore(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 rounded border bg-background"
                    />
                  </div>
                </div>
              </div>

              {/* Triage Category */}
              <div>
                <h3 className="font-medium mb-3">Triage Category *</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(["red", "orange", "yellow", "green"] as const).map(cat => (
                    <button
                      key={cat}
                      onClick={() => setTriageCategory(cat)}
                      className={`p-4 rounded border text-center font-semibold transition-colors ${
                        triageCategory === cat
                          ? cat === "red" ? "border-red-500 bg-red-500 text-white" :
                            cat === "orange" ? "border-orange-500 bg-orange-500 text-white" :
                            cat === "yellow" ? "border-yellow-500 bg-yellow-500 text-white" :
                            "border-green-500 bg-green-500 text-white"
                          : "border-border bg-background hover:bg-accent"
                      }`}
                    >
                      <div className="text-2xl mb-1">
                        {cat === "red" ? "🔴" : cat === "orange" ? "🟠" : cat === "yellow" ? "🟡" : "🟢"}
                      </div>
                      <div className="text-sm">{cat.toUpperCase()}</div>
                      <div className="text-xs mt-1 opacity-75">
                        {cat === "red" ? "Emergency" : cat === "orange" ? "Urgent" : cat === "yellow" ? "Semi-urgent" : "Routine"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium mb-2">Nursing Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional observations or concerns..."
                  rows={3}
                  className="w-full px-4 py-2 rounded border bg-background"
                />
              </div>

              {/* Submit */}
              <div className="pt-4">
                <button
                  onClick={handleSaveTriage}
                  disabled={submitting}
                  className="demo-btn-primary w-full"
                >
                  {submitting ? "Saving..." : "Save Triage & Send to Doctor"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DemoShell>
  )
}
