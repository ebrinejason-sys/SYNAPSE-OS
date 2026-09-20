"use client"

import { useState, useEffect } from "react"
import { DemoShell } from "../../../components/demo/DemoShell"
import { DemoEmptyState } from "../../../components/demo/DemoEmptyState"
import { applyStationSession } from "../../../lib/demo/stations"
import {
  getQueue,
  getPerson,
  getEncounter,
  getTriage,
  getClinicalNote,
  saveClinicalNote,
  createOrder,
  createPrescription,
  createDiagnosis,
  appendTimelineEvent,
  appendAuditEvent,
  createExchangeEvent,
  createNotification,
  getInventoryItems,
  getLabResults,
} from "../../../lib/demo/browser-repository"
import { DemoIntelligenceCopilot } from "../../../components/demo/DemoIntelligenceCopilot"

type Tab = "history" | "examination" | "assessment" | "investigations" | "results" | "prescriptions" | "disposition"

const LAB_TESTS = [
  { code: "FBC", name: "Full Blood Count", loinc: "58410-2" },
  { code: "MALARIA_RDT", name: "Malaria Rapid Diagnostic Test", loinc: "32700-7" },
  { code: "RFT", name: "Renal Function Tests", loinc: "24362-6" },
  { code: "LFT", name: "Liver Function Tests", loinc: "24325-3" },
  { code: "GLUCOSE", name: "Random Blood Glucose", loinc: "2345-7" },
  { code: "URINALYSIS", name: "Urinalysis", loinc: "24327-9" },
  { code: "HIV_RAPID", name: "HIV Rapid Test", loinc: "75622-1" },
  { code: "HBsAg", name: "Hepatitis B Surface Antigen", loinc: "5195-3" },
]

export default function DoctorDemoPage() {
  const [queueItems, setQueueItems] = useState<any[]>([])
  const [queueLoaded, setQueueLoaded] = useState(false)
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [patient, setPatient] = useState<any>(null)
  const [encounter, setEncounter] = useState<any>(null)
  const [triage, setTriage] = useState<any>(null)
  const [clinicalNote, setClinicalNote] = useState<any>(null)
  const [medications, setMedications] = useState<any[]>([])
  const [labResults, setLabResults] = useState<any[]>([])
  const [resultsAcknowledged, setResultsAcknowledged] = useState(false)
  const [labsOrdered, setLabsOrdered] = useState(false)
  const [rxSent, setRxSent] = useState(false)
  
  const [activeTab, setActiveTab] = useState<Tab>("history")
  
  // Clinical note fields
  const [chiefComplaint, setChiefComplaint] = useState("")
  const [hpi, setHpi] = useState("")
  const [pmh, setPmh] = useState("")
  const [psh, setPsh] = useState("")
  const [currentMedications, setCurrentMedications] = useState("")
  const [allergies, setAllergies] = useState("")
  const [familyHistory, setFamilyHistory] = useState("")
  const [socialHistory, setSocialHistory] = useState("")
  const [ros, setRos] = useState("")
  const [generalExam, setGeneralExam] = useState("")
  const [systemicExam, setSystemicExam] = useState("")
  const [assessment, setAssessment] = useState("")
  const [plan, setPlan] = useState("")
  
  // Differentials
  const [differentials, setDifferentials] = useState<Array<{ condition: string; icd11Code?: string; confidence: "high" | "medium" | "low" }>>([])
  const [newDifferential, setNewDifferential] = useState("")
  const [newDifferentialConfidence, setNewDifferentialConfidence] = useState<"high" | "medium" | "low">("high")
  
  // Lab orders
  const [selectedTests, setSelectedTests] = useState<string[]>([])
  const [labPriority, setLabPriority] = useState<"routine" | "urgent" | "stat">("routine")
  const [clinicalQuestion, setClinicalQuestion] = useState("")
  
  // Prescriptions
  const [prescriptions, setPrescriptions] = useState<Array<{
    medicationId: string
    medicationName: string
    strength: string
    form: string
    dose: string
    route: string
    frequency: string
    duration: string
    quantity: number
    instructions: string
  }>>([])
  
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved] = useState(false)

  function patchPrescription(idx: number, patch: Partial<(typeof prescriptions)[number]>) {
    setPrescriptions((prev) => prev.map((rx, i) => (i === idx ? { ...rx, ...patch } : rx)))
  }
  const [signed, setSigned] = useState(false)

  useEffect(() => {
    loadQueue()
    loadMedications()
    if (typeof window !== "undefined" && window.location.search.includes("stage=review")) {
      setActiveTab("results")
    }
  }, [])

  useEffect(() => {
    if (selectedItem) {
      loadPatientData()
    }
  }, [selectedItem])

  async function loadQueue() {
    const queue = await getQueue()
    const doctorQueue = queue.filter(q => q.queueType === "doctor" && q.status === "waiting")
    setQueueItems(doctorQueue)

    if (doctorQueue.length > 0 && !selectedItem) {
      setSelectedItem(doctorQueue[0])
    }
    setQueueLoaded(true)
  }

  async function loadMedications() {
    const items = await getInventoryItems()
    setMedications(items)
  }

  async function loadPatientData() {
    if (!selectedItem) return

    const [p, e, t, note, results] = await Promise.all([
      getPerson(selectedItem.personId),
      getEncounter(selectedItem.encounterId),
      getTriage(selectedItem.encounterId),
      getClinicalNote(selectedItem.encounterId),
      getLabResults(),
    ])

    setPatient(p)
    setEncounter(e)
    setTriage(t)
    setClinicalNote(note)
    setLabResults(results.filter((row) => row.encounterId === selectedItem.encounterId))

    // Load existing note data
    if (note) {
      setChiefComplaint(note.chiefComplaint || "")
      setHpi(note.hpi || "")
      setPmh(note.pmh || "")
      setPsh(note.psh || "")
      setCurrentMedications(note.medications || "")
      setAllergies(note.allergies || "")
      setFamilyHistory(note.familyHistory || "")
      setSocialHistory(note.socialHistory || "")
      setRos(note.ros || "")
      setGeneralExam(note.generalExam || "")
      setSystemicExam(note.systemicExam || "")
      setAssessment(note.assessment || "")
      setPlan(note.plan || "")
      setDifferentials(note.differentials || [])
      setSigned(note.status === "signed")
    } else if (e) {
      setChiefComplaint(e.complaint || "")
    }
  }

  async function handleSaveNote(signNote = false) {
    if (!encounter || !patient) return

    setSubmitting(true)
    try {
      const note = await saveClinicalNote({
        id: clinicalNote?.id,
        encounterId: encounter.id,
        personId: patient.id,
        facilityId: "demo-hospital",
        authorId: "doctor-demo",
        status: signNote ? "signed" : "draft",
        chiefComplaint: chiefComplaint.trim() || undefined,
        hpi: hpi.trim() || undefined,
        pmh: pmh.trim() || undefined,
        psh: psh.trim() || undefined,
        medications: currentMedications.trim() || undefined,
        allergies: allergies.trim() || undefined,
        familyHistory: familyHistory.trim() || undefined,
        socialHistory: socialHistory.trim() || undefined,
        ros: ros.trim() || undefined,
        generalExam: generalExam.trim() || undefined,
        systemicExam: systemicExam.trim() || undefined,
        assessment: assessment.trim() || undefined,
        plan: plan.trim() || undefined,
        differentials: differentials.length > 0 ? differentials : undefined,
        signedAt: signNote ? new Date().toISOString() : undefined
      })

      await appendTimelineEvent({
        personId: patient.id,
        encounterId: encounter.id,
        facilityId: "demo-hospital",
        actorId: "doctor-demo",
        eventType: signNote ? "clinical_note_signed" : "clinical_note_saved",
        title: signNote ? "Clinical note signed" : "Clinical note saved",
        description: signNote ? "Doctor completed clinical documentation" : "Draft saved"
      })

      await appendAuditEvent({
        actorId: "doctor-demo",
        actorRole: "doctor",
        facilityId: "demo-hospital",
        action: signNote ? "clinical_note.sign" : "clinical_note.save",
        entityType: "clinical_note",
        entityId: note.id,
        personId: patient.id,
        encounterId: encounter.id,
        after: note
      })

      setSaved(true)
      if (signNote) {
        setSigned(true)
      }
      setClinicalNote(note)
    } catch (error) {
      console.error("Failed to save note:", error)
      alert("Failed to save note. Check console for details.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleOrderLabs() {
    if (!encounter || !patient || selectedTests.length === 0) return

    setSubmitting(true)
    try {
      for (const testCode of selectedTests) {
        const test = LAB_TESTS.find(t => t.code === testCode)
        if (!test) continue

        const order = await createOrder({
          encounterId: encounter.id,
          personId: patient.id,
          sourceFacilityId: "demo-hospital",
          destinationFacilityId: "demo-lab",
          orderedBy: "doctor-demo",
          orderType: "lab",
          testCode: test.code,
          testName: test.name,
          loincCode: test.loinc,
          priority: labPriority,
          clinicalQuestion: clinicalQuestion.trim() || undefined,
          status: "ordered"
        })

        // Exchange event to lab
        await createExchangeEvent({
          type: "lab_order",
          personId: patient.id,
          encounterId: encounter.id,
          sourceFacilityId: "demo-hospital",
          destinationFacilityId: "demo-lab",
          actorId: "doctor-demo",
          payload: { order },
          status: "pending"
        })
      }

      await appendTimelineEvent({
        personId: patient.id,
        encounterId: encounter.id,
        facilityId: "demo-hospital",
        actorId: "doctor-demo",
        eventType: "lab_ordered",
        title: `Lab tests ordered (${selectedTests.length})`,
        description: selectedTests.join(", ")
      })

      // Notify lab
      await createNotification({
        userId: "lab-tech-demo",
        facilityId: "demo-lab",
        type: "order",
        title: "New lab order",
        message: `${patient.name} - ${selectedTests.length} tests`,
        read: false,
        relatedEntityId: encounter.id,
        relatedEntityType: "encounter"
      })

      setSelectedTests([])
      setClinicalQuestion("")
      setLabsOrdered(true)
    } catch (error) {
      console.error("Failed to order labs:", error)
      alert("Failed to order labs. Check console for details.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handlePrescribe() {
    if (!encounter || !patient || prescriptions.length === 0) return

    setSubmitting(true)
    try {
      for (const rx of prescriptions) {
        const prescription = await createPrescription({
          encounterId: encounter.id,
          personId: patient.id,
          facilityId: "demo-pharmacy",
          prescribedBy: "doctor-demo",
          medicationId: rx.medicationId,
          medicationName: rx.medicationName,
          strength: rx.strength,
          form: rx.form,
          dose: rx.dose,
          route: rx.route,
          frequency: rx.frequency,
          duration: rx.duration,
          quantity: rx.quantity,
          instructions: rx.instructions,
          status: "active"
        })

        // Exchange event to pharmacy
        await createExchangeEvent({
          type: "prescription",
          personId: patient.id,
          encounterId: encounter.id,
          sourceFacilityId: "demo-hospital",
          destinationFacilityId: "demo-pharmacy",
          actorId: "doctor-demo",
          payload: { prescription },
          status: "pending"
        })
      }

      await appendTimelineEvent({
        personId: patient.id,
        encounterId: encounter.id,
        facilityId: "demo-hospital",
        actorId: "doctor-demo",
        eventType: "prescription_written",
        title: `Prescriptions written (${prescriptions.length})`,
        description: prescriptions.map(p => `${p.medicationName} ${p.strength}`).join(", ")
      })

      // Notify pharmacy
      await createNotification({
        userId: "pharmacist-demo",
        facilityId: "demo-pharmacy",
        type: "order",
        title: "New prescription",
        message: `${patient.name} - ${prescriptions.length} medications`,
        read: false,
        relatedEntityId: encounter.id,
        relatedEntityType: "encounter"
      })

      setPrescriptions([])
      setRxSent(true)
    } catch (error) {
      console.error("Failed to prescribe:", error)
      alert("Failed to prescribe. Check console for details.")
    } finally {
      setSubmitting(false)
    }
  }

  function addDifferential() {
    if (!newDifferential.trim()) return
    setDifferentials([...differentials, { 
      condition: newDifferential, 
      confidence: newDifferentialConfidence 
    }])
    if (encounter && patient) {
      void createDiagnosis({
        encounterId: encounter.id,
        personId: patient.id,
        facilityId: "demo-hospital",
        diagnosedBy: "doctor-demo",
        condition: newDifferential.trim(),
        icd11Code: "1F40",
        icd11Title: newDifferential.trim(),
        type: "primary",
        certainty: newDifferentialConfidence === "high" ? "confirmed" : "probable",
      }).catch((error) => console.error(error))
    }
    setNewDifferential("")
  }

  function addPrescription() {
    if (medications.length === 0) return
    const med = medications.find((item) => /artemether|lumefantrine|coartem/i.test(`${item.name} ${item.genericName || ""}`)) ?? medications[0]
    setPrescriptions([...prescriptions, {
      medicationId: med.id,
      medicationName: med.name,
      strength: med.strength,
      form: med.form,
      dose: "1",
      route: "Oral",
      frequency: "TDS",
      duration: "3 days",
      quantity: 24,
      instructions: "Take with food"
    }])
  }

  const tabs: Array<{ id: Tab; label: string; icon: string }> = [
    { id: "history", label: "History", icon: "📋" },
    { id: "examination", label: "Examination", icon: "🔍" },
    { id: "assessment", label: "Assessment", icon: "🎯" },
    { id: "investigations", label: "Investigations", icon: "🧪" },
    { id: "results", label: "Results", icon: "📈" },
    { id: "prescriptions", label: "Prescription", icon: "💊" },
    { id: "disposition", label: "Disposition", icon: "✅" },
  ]

  if (!selectedItem || !patient || !encounter) {
    return (
      <DemoShell title="Doctor Workspace" description="Review triage, document, order labs, then prescribe." requiresRole={["doctor", "admin"]}>
        {queueItems.length === 0 ? (
          queueLoaded ? (
          <DemoEmptyState
            title="No patient ready for Doctor review"
            body="Complete Reception and Triage first."
            primaryLabel="Go to Reception"
            primaryStation="reception"
            secondaryLabel="Go to Nurse Queue"
            secondaryStation="nurse"
          />
          ) : <div className="demo-card h-24" aria-hidden="true" />
        ) : (
          <div className="demo-card h-24" aria-hidden="true" />
        )}
      </DemoShell>
    )
  }

  const calculateAge = (dob: string) => {
    if (!dob) return "?"
    return new Date().getFullYear() - new Date(dob).getFullYear()
  }

  return (
    <DemoShell title="Doctor Workspace" requiresRole={["doctor", "admin"]}>
      <div className="space-y-6">
        {labResults.some((row) => row.status === "released") && !resultsAcknowledged ? (
          <div className="demo-card space-y-3 p-4">
            <p className="font-bold">NEW LAB RESULT</p>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Released results are ready for this visit.</p>
            <button
              type="button"
              className="demo-btn-primary"
              onClick={() => {
                setActiveTab("results")
                setResultsAcknowledged(true)
              }}
            >
              Review Results
            </button>
          </div>
        ) : null}
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-2xl font-bold">{patient.name}</h2>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">SYNAPSE ID</p>
                  <p className="font-semibold">{patient.synapseId}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Age / Sex</p>
                  <p className="font-semibold">{calculateAge(patient.dateOfBirth)} years · {patient.sex}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Chief Complaint</p>
                  <p className="font-semibold">{encounter.complaint}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Visit Type</p>
                  <p className="font-semibold">{encounter.visitType}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {saved && (
                <span className="px-3 py-1 rounded text-xs font-semibold bg-green-500/10 text-green-500">
                  {signed ? "✅ Signed" : "💾 Saved"}
                </span>
              )}
            </div>
          </div>

          {/* Vitals from Triage */}
          {triage && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm font-semibold mb-2">Vitals from Triage</p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-sm">
                {triage.temperatureC && (
                  <div>
                    <p className="text-muted-foreground text-xs">Temp</p>
                    <p className="font-semibold">{triage.temperatureC}°C</p>
                  </div>
                )}
                {triage.heartRate && (
                  <div>
                    <p className="text-muted-foreground text-xs">HR</p>
                    <p className="font-semibold">{triage.heartRate} bpm</p>
                  </div>
                )}
                {triage.bpSystolic && triage.bpDiastolic && (
                  <div>
                    <p className="text-muted-foreground text-xs">BP</p>
                    <p className="font-semibold">{triage.bpSystolic}/{triage.bpDiastolic}</p>
                  </div>
                )}
                {triage.spo2 && (
                  <div>
                    <p className="text-muted-foreground text-xs">SpO₂</p>
                    <p className="font-semibold">{triage.spo2}%</p>
                  </div>
                )}
                {triage.triageCategory && (
                  <div>
                    <p className="text-muted-foreground text-xs">Triage</p>
                    <p className="font-semibold">{triage.triageCategory.toUpperCase()}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DemoIntelligenceCopilot
          entryLabel="Synapse AI"
          defaultTask="clinical_copilot"
          packet={{
            patientId: patient.id,
            tenantId: "demo-hospital",
            clinicianId: "doctor-demo",
            presentingComplaint: chiefComplaint || encounter.complaint || "Fever and headache for 3 days",
            history: [hpi, pmh].filter(Boolean),
            examination: [generalExam, systemicExam].filter(Boolean),
            vitals: triage ? {
              temperatureC: triage.temperatureC,
              heartRate: triage.heartRate,
              bpSystolic: triage.bpSystolic,
              bpDiastolic: triage.bpDiastolic,
              spo2: triage.spo2,
            } : undefined,
            laboratory: labResults.map((row: { testName?: string; value?: string; interpretation?: string }) => ({
              test: String(row.testName ?? "result"),
              value: String(row.value ?? ""),
              flag: row.interpretation === "high" || row.interpretation === "critical" ? "H" : undefined,
            })),
            medications: currentMedications ? [currentMedications] : undefined,
            allergies: allergies ? [allergies] : undefined,
          }}
        />

        {/* Tabs */}
        <div className="border-b">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 font-medium text-sm whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? "border-b-2 border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="rounded-lg border bg-card p-6">
          {activeTab === "history" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2">Chief Complaint</label>
                <input
                  type="text"
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  className="w-full px-4 py-2 rounded border bg-background"
                />
              </div>
              <div>
                <label htmlFor="doctor-hpi" className="block text-sm font-semibold mb-2">History of Present Illness (HPI)</label>
                <textarea
                  id="doctor-hpi"
                  value={hpi}
                  onChange={(e) => setHpi(e.target.value)}
                  rows={5}
                  placeholder="Detailed history of current illness..."
                  className="w-full px-4 py-2 rounded border bg-background"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Past Medical History</label>
                  <textarea
                    value={pmh}
                    onChange={(e) => setPmh(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 rounded border bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Past Surgical History</label>
                  <textarea
                    value={psh}
                    onChange={(e) => setPsh(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 rounded border bg-background"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Current Medications</label>
                  <textarea
                    value={currentMedications}
                    onChange={(e) => setCurrentMedications(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2 rounded border bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Allergies</label>
                  <textarea
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2 rounded border bg-background"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Family History</label>
                  <textarea
                    value={familyHistory}
                    onChange={(e) => setFamilyHistory(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2 rounded border bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2">Social History</label>
                  <textarea
                    value={socialHistory}
                    onChange={(e) => setSocialHistory(e.target.value)}
                    rows={2}
                    className="w-full px-4 py-2 rounded border bg-background"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Review of Systems (ROS)</label>
                <textarea
                  value={ros}
                  onChange={(e) => setRos(e.target.value)}
                  rows={4}
                  placeholder="Systematic review..."
                  className="w-full px-4 py-2 rounded border bg-background"
                />
              </div>
            </div>
          )}

          {activeTab === "examination" && (
            <div className="space-y-4">
              <div>
                <label htmlFor="doctor-exam" className="block text-sm font-semibold mb-2">General Examination</label>
                <textarea
                  id="doctor-exam"
                  value={generalExam}
                  onChange={(e) => setGeneralExam(e.target.value)}
                  rows={5}
                  placeholder="General appearance, hydration, nutritional status..."
                  className="w-full px-4 py-2 rounded border bg-background"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Systemic Examination</label>
                <textarea
                  value={systemicExam}
                  onChange={(e) => setSystemicExam(e.target.value)}
                  rows={8}
                  placeholder="Cardiovascular, Respiratory, Abdominal, Neurological, etc."
                  className="w-full px-4 py-2 rounded border bg-background"
                />
              </div>
            </div>
          )}

          {activeTab === "assessment" && (
            <div className="space-y-4">
              <div>
                <label htmlFor="doctor-assessment" className="block text-sm font-semibold mb-2">Clinical Assessment</label>
                <textarea
                  id="doctor-assessment"
                  value={assessment}
                  onChange={(e) => setAssessment(e.target.value)}
                  rows={5}
                  placeholder="Summary of findings and clinical reasoning..."
                  className="w-full px-4 py-2 rounded border bg-background"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold mb-3">Differential Diagnoses</label>
                <div className="space-y-2">
                  {differentials.map((diff, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-3 rounded border bg-background">
                      <span className="flex-1">{diff.condition}</span>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        diff.confidence === "high" ? "bg-green-500/10 text-green-500" :
                        diff.confidence === "medium" ? "bg-yellow-500/10 text-yellow-500" :
                        "bg-gray-500/10 text-gray-500"
                      }`}>
                        {diff.confidence}
                      </span>
                      <button
                        onClick={() => setDifferentials(differentials.filter((_, i) => i !== idx))}
                        className="text-red-500 hover:text-red-600"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={newDifferential}
                    onChange={(e) => setNewDifferential(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addDifferential()}
                    placeholder="Add differential diagnosis..."
                    aria-label="Add differential diagnosis"
                    className="flex-1 px-4 py-2 rounded border bg-background"
                  />
                  <select
                    value={newDifferentialConfidence}
                    onChange={(e) => setNewDifferentialConfidence(e.target.value as any)}
                    className="px-3 py-2 rounded border bg-background"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <button
                    onClick={addDifferential}
                    className="px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Management Plan</label>
                <textarea
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  rows={5}
                  placeholder="Treatment plan, follow-up, patient education..."
                  className="w-full px-4 py-2 rounded border bg-background"
                />
              </div>
            </div>
          )}

          {activeTab === "investigations" && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-lg mb-3">Order Lab Tests</h3>
                <div className="space-y-3">
                  {LAB_TESTS.map(test => (
                    <label key={test.code} className="flex items-center gap-3 p-3 rounded border bg-background cursor-pointer hover:bg-accent">
                      <input
                        type="checkbox"
                        checked={selectedTests.includes(test.code)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedTests([...selectedTests, test.code])
                          } else {
                            setSelectedTests(selectedTests.filter(t => t !== test.code))
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <div className="flex-1">
                        <p className="font-medium">{test.name}</p>
                        <p className="text-xs text-muted-foreground">Code: {test.code} · LOINC: {test.loinc}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {selectedTests.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="block text-sm font-semibold mb-2">Priority</label>
                      <div className="flex gap-2">
                        {(["routine", "urgent", "stat"] as const).map(p => (
                          <button
                            key={p}
                            onClick={() => setLabPriority(p)}
                            className={`px-4 py-2 rounded border text-sm font-medium ${
                              labPriority === p
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background hover:bg-accent"
                            }`}
                          >
                            {p.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold mb-2">Clinical Question</label>
                      <textarea
                        value={clinicalQuestion}
                        onChange={(e) => setClinicalQuestion(e.target.value)}
                        rows={2}
                        placeholder="Why are you ordering these tests?"
                        className="w-full px-4 py-2 rounded border bg-background"
                      />
                    </div>

                    <button
                      onClick={handleOrderLabs}
                      disabled={submitting}
                      className="demo-btn-primary w-full"
                    >
                      {submitting ? "Ordering..." : `Order ${selectedTests.length} Test(s)`}
                    </button>
                  </div>
                )}
                {labsOrdered ? (
                  <div className="mt-4 space-y-3">
                    <p className="text-sm">Lab orders sent to Demo Lab.</p>
                    <a className="demo-btn-primary" href="/demo/lab" onClick={() => applyStationSession("lab")}>
                      Continue as Lab
                    </a>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {activeTab === "results" && (
            <div className="space-y-4">
              {labResults.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  No lab results yet. Order tests, then continue as Lab.
                </p>
              ) : (
                labResults.map((result) => (
                  <div key={result.id} className="demo-card p-4">
                    <p className="font-semibold">{result.testName}</p>
                    <p className="text-sm">
                      {result.value} {result.unit || ""} · {result.status} · {result.interpretation}
                    </p>
                  </div>
                ))
              )}
              {labResults.some((row) => row.status === "released") ? (
                <button type="button" className="demo-btn-primary" onClick={() => { setResultsAcknowledged(true); setActiveTab("assessment") }}>
                  Acknowledge results
                </button>
              ) : null}
              {labResults.length > 0 ? (
                <DemoIntelligenceCopilot
                  entryLabel="AI Result Analysis"
                  defaultTask="lab_interpretation"
                  allowTaskSwitch={false}
                  packet={{
                    patientId: patient.id,
                    tenantId: "demo-hospital",
                    clinicianId: "doctor-demo",
                    presentingComplaint: chiefComplaint || encounter.complaint || "Fever and headache for 3 days",
                    laboratory: labResults.map((row: { testName?: string; value?: string; interpretation?: string }) => ({
                      test: String(row.testName ?? "result"),
                      value: String(row.value ?? ""),
                      flag: row.interpretation === "high" || row.interpretation === "critical" ? "H" : undefined,
                    })),
                  }}
                />
              ) : null}
            </div>
          )}

          {activeTab === "prescriptions" && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-lg mb-3">Prescriptions</h3>
                <div className="space-y-3">
                  {prescriptions.map((rx, idx) => (
                    <div key={idx} className="p-4 rounded border bg-background">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1">
                          <p className="font-semibold">{rx.medicationName} {rx.strength}</p>
                          <p className="text-sm text-muted-foreground">{rx.form}</p>
                        </div>
                        <button
                          onClick={() => setPrescriptions(prescriptions.filter((_, i) => i !== idx))}
                          className="text-red-500 hover:text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Dose</p>
                          <input
                            type="text"
                            value={rx.dose}
                            onChange={(e) => patchPrescription(idx, { dose: e.target.value })}
                            className="w-full px-2 py-1 rounded border bg-background text-sm"
                          />
                        </div>
                        <div>
                          <p className="text-muted-foreground">Route</p>
                          <input
                            type="text"
                            value={rx.route}
                            onChange={(e) => patchPrescription(idx, { route: e.target.value })}
                            className="w-full px-2 py-1 rounded border bg-background text-sm"
                          />
                        </div>
                        <div>
                          <p className="text-muted-foreground">Frequency</p>
                          <input
                            type="text"
                            value={rx.frequency}
                            onChange={(e) => patchPrescription(idx, { frequency: e.target.value })}
                            className="w-full px-2 py-1 rounded border bg-background text-sm"
                          />
                        </div>
                        <div>
                          <p className="text-muted-foreground">Duration</p>
                          <input
                            type="text"
                            value={rx.duration}
                            onChange={(e) => patchPrescription(idx, { duration: e.target.value })}
                            className="w-full px-2 py-1 rounded border bg-background text-sm"
                          />
                        </div>
                        <div>
                          <p className="text-muted-foreground">Quantity</p>
                          <input
                            type="number"
                            value={rx.quantity}
                            onChange={(e) => patchPrescription(idx, { quantity: parseInt(e.target.value) || 0 })}
                            className="w-full px-2 py-1 rounded border bg-background text-sm"
                          />
                        </div>
                        <div className="col-span-2">
                          <p className="text-muted-foreground">Instructions</p>
                          <input
                            type="text"
                            value={rx.instructions}
                            onChange={(e) => patchPrescription(idx, { instructions: e.target.value })}
                            className="w-full px-2 py-1 rounded border bg-background text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex gap-3">
                  <button
                    onClick={addPrescription}
                    className="px-4 py-2 rounded bg-secondary hover:bg-secondary/80 transition-colors"
                  >
                    + Add Medication
                  </button>
                  {prescriptions.length > 0 && (
                    <button
                      onClick={handlePrescribe}
                      disabled={submitting}
                      className="demo-btn-primary flex-1"
                    >
                      {submitting ? "Prescribing..." : `Prescribe ${prescriptions.length} Medication(s)`}
                    </button>
                  )}
                </div>
                {rxSent ? (
                  <div className="mt-4">
                    <a className="demo-btn-primary" href="/demo/pharmacist" onClick={() => applyStationSession("pharmacist")}>
                      Continue as Pharmacy
                    </a>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {activeTab === "disposition" && (
            <div className="space-y-6">
              <div className="rounded border border-orange-500/20 bg-orange-500/10 p-4">
                <h3 className="font-semibold mb-2">⚠️ Before Signing</h3>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li>✓ Complete clinical documentation</li>
                  <li>✓ Order necessary investigations</li>
                  <li>✓ Write prescriptions if needed</li>
                  <li>✓ Document management plan</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleSaveNote(false)}
                  disabled={submitting}
                  className="flex-1 px-6 py-3 rounded border border-border bg-background hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "💾 Save Draft"}
                </button>
                <button
                  onClick={() => handleSaveNote(true)}
                  disabled={submitting || signed}
                  className="flex-1 px-6 py-3 rounded bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {submitting ? "Signing..." : signed ? "✅ Already Signed" : "✍️ Sign Note"}
                </button>
              </div>

              {signed && (
                <div className="rounded-lg border bg-card p-6 text-center space-y-3">
                  <div className="text-6xl">✅</div>
                  <h3 className="text-xl font-bold">Clinical Note Signed</h3>
                  <p className="text-sm text-muted-foreground">Documentation complete for this encounter</p>
                  <div className="pt-4">
                    <a
                      className="demo-btn-primary"
                      href="/demo/lab"
                      onClick={() => applyStationSession("lab")}
                    >
                      Continue as Lab
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DemoShell>
  )
}
