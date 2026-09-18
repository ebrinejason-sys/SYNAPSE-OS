"use client"

import { useState, useEffect } from "react"
import { DemoShell } from "../../../components/demo/DemoShell"
import { applyStationSession } from "../../../lib/demo/stations"
import { 
  initializePlayground, 
  getPersons, 
  createEncounter, 
  queuePatient, 
  appendTimelineEvent, 
  appendAuditEvent,
} from "../../../lib/demo/browser-repository"

export default function ReceptionDemoPage() {
  const [initialized, setInitialized] = useState(false)
  const [persons, setPersons] = useState<any[]>([])
  const [selectedPerson, setSelectedPerson] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState("")
  
  // Form state
  const [visitType, setVisitType] = useState<"consultation" | "procedure" | "admission" | "referral">("consultation")
  const [encounterType, setEncounterType] = useState<"opd" | "ipd" | "emergency" | "follow_up">("opd")
  const [paymentCategory, setPaymentCategory] = useState<"cash" | "insurance" | "government" | "waiver">("cash")
  const [complaint, setComplaint] = useState("")
  const [priority, setPriority] = useState<"routine" | "urgent" | "emergency">("routine")
  
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [newEncounter, setNewEncounter] = useState<any>(null)

  useEffect(() => {
    init()
  }, [])

  async function init() {
    await initializePlayground()
    const allPersons = await getPersons()
    setPersons(allPersons)
    if (allPersons.length > 0) {
      setSelectedPerson(allPersons[0])
    }
    setInitialized(true)
  }

  async function handleSearch() {
    if (!searchQuery.trim()) {
      const allPersons = await getPersons()
      setPersons(allPersons)
      return
    }

    const allPersons = await getPersons()
    const filtered = allPersons.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.synapseId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.phone?.includes(searchQuery)
    )
    setPersons(filtered)
  }

  async function handleStartVisit() {
    if (!selectedPerson) {
      alert("Please select a patient first")
      return
    }

    if (!complaint.trim()) {
      alert("Please enter chief complaint")
      return
    }

    setSubmitting(true)
    try {
      // Create encounter
      const encounter = await createEncounter({
        personId: selectedPerson.id,
        facilityId: "demo-hospital",
        encounterType,
        status: "active",
        visitType,
        complaint,
        paymentCategory,
        startedAt: new Date().toISOString()
      })

      // Add to triage queue
      await queuePatient({
        encounterId: encounter.id,
        personId: selectedPerson.id,
        facilityId: "demo-hospital",
        queueType: "triage",
        priority,
        status: "waiting",
        position: 1
      })

      // Timeline event
      await appendTimelineEvent({
        personId: selectedPerson.id,
        encounterId: encounter.id,
        facilityId: "demo-hospital",
        actorId: "reception-demo",
        eventType: "encounter_started",
        title: `Visit started: ${visitType}`,
        description: `${encounterType.toUpperCase()} · ${paymentCategory} · ${complaint}`
      })

      // Audit event
      await appendAuditEvent({
        actorId: "reception-demo",
        actorRole: "reception",
        facilityId: "demo-hospital",
        action: "encounter.create",
        entityType: "encounter",
        entityId: encounter.id,
        personId: selectedPerson.id,
        encounterId: encounter.id,
        after: encounter
      })

      setNewEncounter(encounter)
      setSuccess(true)
      setComplaint("")
    } catch (error) {
      console.error("Failed to start visit:", error)
      alert("Failed to start visit. Check console for details.")
    } finally {
      setSubmitting(false)
    }
  }

  function resetForm() {
    setSuccess(false)
    setNewEncounter(null)
    setComplaint("")
    setPriority("routine")
  }

  if (!initialized) {
    return (
      <DemoShell title="Reception" description="Find Amina, start an OPD visit, send to triage." requiresRole={["reception", "admin"]}>
        <div className="demo-card h-24" aria-hidden="true" />
      </DemoShell>
    )
  }

  if (success && newEncounter) {
    return (
      <DemoShell title="Reception" requiresRole={["reception", "admin"]}>
        <div className="rounded-lg border bg-card p-8 text-center space-y-4">
          <div className="text-6xl">✅</div>
          <h2 className="text-2xl font-bold">Visit Started Successfully</h2>
          <div className="space-y-2 text-left max-w-md mx-auto">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Patient:</span>
              <span className="font-medium">{selectedPerson.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">SYNAPSE ID:</span>
              <span className="font-medium">{selectedPerson.synapseId}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Encounter ID:</span>
              <span className="font-mono text-xs">{newEncounter.id.slice(0, 8)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Visit Type:</span>
              <span className="font-medium">{visitType}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Payment:</span>
              <span className="font-medium">{paymentCategory}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Priority:</span>
              <span className="font-medium">{priority}</span>
            </div>
          </div>
          <div className="pt-4 space-y-3">
            <p className="text-sm text-muted-foreground">Patient added to Triage queue</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={resetForm}
                className="px-4 py-2 rounded bg-secondary hover:bg-secondary/80 transition-colors"
              >
                Register Another Patient
              </button>
              <a
                className="demo-btn-primary"
                href="/demo/nurse"
                onClick={() => applyStationSession("nurse")}
              >
                Continue as Nurse
              </a>
            </div>
          </div>
        </div>
      </DemoShell>
    )
  }

  return (
    <DemoShell title="Reception" requiresRole={["reception", "admin"]}>
      <div className="space-y-6">
        {/* Patient Search */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="font-semibold text-lg mb-4">Patient Search</h2>
            <div className="flex gap-3">
            <label className="sr-only" htmlFor="patient-search">Search patients</label>
            <input
              id="patient-search"
              type="text"
              placeholder="Search by name, ID, or phone"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1 px-4 py-2 rounded border bg-background"
            />
            <button
              onClick={handleSearch}
              className="px-6 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Search
            </button>
          </div>

          {/* Search Results */}
          {persons.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-muted-foreground">{persons.length} patient(s) found</p>
              {persons.map(person => (
                <button
                  key={person.id}
                  onClick={() => setSelectedPerson(person)}
                  className={`w-full p-4 rounded border text-left transition-colors ${
                    selectedPerson?.id === person.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{person.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {person.synapseId} · {person.sex} · {person.dateOfBirth || "DOB unknown"}
                      </p>
                      {person.phone && (
                        <p className="text-sm text-muted-foreground">{person.phone}</p>
                      )}
                    </div>
                    {selectedPerson?.id === person.id && (
                      <span className="text-primary text-xl">✓</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {persons.length === 0 && searchQuery && (
            <div className="mt-4 text-center py-8 text-muted-foreground">
              <p>No patients found matching "{searchQuery}"</p>
              <p className="text-sm mt-2">Try a different search term</p>
            </div>
          )}
        </div>

        {/* Visit Details Form */}
        {selectedPerson && (
          <div className="rounded-lg border bg-card p-6">
            <h2 className="font-semibold text-lg mb-4">Start New Visit</h2>
            
            <div className="space-y-4">
              {/* Selected Patient Info */}
              <div className="p-4 rounded bg-accent">
                <p className="text-sm text-muted-foreground mb-1">Selected Patient</p>
                <p className="font-semibold">{selectedPerson.name}</p>
                <p className="text-sm text-muted-foreground">{selectedPerson.synapseId}</p>
              </div>

              {/* Visit Type */}
              <div>
                <label className="block text-sm font-medium mb-2">Visit Type *</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(["consultation", "procedure", "admission", "referral"] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => setVisitType(type)}
                      className={`px-4 py-2 rounded border text-sm font-medium transition-colors ${
                        visitType === type
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:bg-accent"
                      }`}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Encounter Type */}
              <div>
                <label className="block text-sm font-medium mb-2">Encounter Type *</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(["opd", "ipd", "emergency", "follow_up"] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => setEncounterType(type)}
                      className={`px-4 py-2 rounded border text-sm font-medium transition-colors ${
                        encounterType === type
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:bg-accent"
                      }`}
                    >
                      {type.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Category */}
              <div>
                <label className="block text-sm font-medium mb-2">Payment Category *</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(["cash", "insurance", "government", "waiver"] as const).map(cat => (
                    <button
                      key={cat}
                      onClick={() => setPaymentCategory(cat)}
                      className={`px-4 py-2 rounded border text-sm font-medium transition-colors ${
                        paymentCategory === cat
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:bg-accent"
                      }`}
                    >
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chief Complaint */}
              <div>
                <label htmlFor="chief-complaint" className="block text-sm font-medium mb-2">Chief Complaint *</label>
                <textarea
                  id="chief-complaint"
                  value={complaint}
                  onChange={(e) => setComplaint(e.target.value)}
                  placeholder="Enter patient's main complaint..."
                  rows={3}
                  className="w-full px-4 py-2 rounded border bg-background"
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium mb-2">Priority</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["routine", "urgent", "emergency"] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      className={`px-4 py-2 rounded border text-sm font-medium transition-colors ${
                        priority === p
                          ? p === "emergency"
                            ? "border-red-500 bg-red-500 text-white"
                            : p === "urgent"
                            ? "border-orange-500 bg-orange-500 text-white"
                            : "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background hover:bg-accent"
                      }`}
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  onClick={handleStartVisit}
                  disabled={submitting || !complaint.trim()}
                  className="demo-btn-primary w-full"
                >
                  {submitting ? "Starting Visit..." : "Start Visit & Send to Triage"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DemoShell>
  )
}
