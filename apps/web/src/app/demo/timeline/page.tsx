"use client"

import { useState, useEffect } from "react"
import { DemoShell } from "../../../components/demo/DemoShell"
import { getTimelineByPerson, getPersons, getEncounters } from "../../../lib/demo/browser-repository"

export default function DemoTimelinePage() {
  const [persons, setPersons] = useState<any[]>([])
  const [selectedPerson, setSelectedPerson] = useState<any>(null)
  const [timeline, setTimeline] = useState<any[]>([])
  const [encounters, setEncounters] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [groupByEncounter, setGroupByEncounter] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (selectedPerson) {
      loadTimeline()
    }
  }, [selectedPerson])

  async function loadData() {
    try {
      const [p, e] = await Promise.all([
        getPersons(),
        getEncounters()
      ])
      setPersons(p)
      setEncounters(e)
      
      if (p.length > 0) {
        setSelectedPerson(p[0])
      }
    } catch (error) {
      console.error("Failed to load data:", error)
    } finally {
      setLoading(false)
    }
  }

  async function loadTimeline() {
    if (!selectedPerson) return

    try {
      const events = await getTimelineByPerson(selectedPerson.id)
      // Sort by createdAt descending (newest first)
      const sorted = events.sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      setTimeline(sorted)
    } catch (error) {
      console.error("Failed to load timeline:", error)
    }
  }

  const getEventIcon = (eventType: string) => {
    const icons: Record<string, string> = {
      playground_started: "🎮",
      encounter_started: "🏥",
      triage_recorded: "🩺",
      clinical_note_saved: "📝",
      clinical_note_signed: "✍️",
      lab_ordered: "🧪",
      lab_order_acknowledged: "✓",
      specimen_collected: "🩸",
      lab_result_entered: "📊",
      lab_results_verified: "✅",
      lab_results_released: "📤",
      prescription_written: "💊",
      prescription_dispensed: "✓",
      payment_received: "💰",
      encounter_completed: "✅"
    }
    return icons[eventType] || "•"
  }

  const getEventColor = (eventType: string) => {
    if (eventType.includes("error") || eventType.includes("failed")) return "text-red-500"
    if (eventType.includes("signed") || eventType.includes("completed") || eventType.includes("verified")) return "text-green-500"
    if (eventType.includes("started") || eventType.includes("ordered")) return "text-blue-500"
    if (eventType.includes("saved") || eventType.includes("entered")) return "text-yellow-500"
    return "text-muted-foreground"
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    
    return date.toLocaleDateString() + " " + date.toLocaleTimeString()
  }

  const groupedTimeline = () => {
    if (!groupByEncounter || timeline.length === 0) return null

    const grouped: Record<string, any[]> = {}
    
    timeline.forEach((event: any) => {
      const key = event.encounterId || "system"
      if (!grouped[key]) {
        grouped[key] = []
      }
      grouped[key].push(event)
    })

    return grouped
  }

  if (loading) {
    return (
      <DemoShell title="Patient Timeline">
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          <p>Loading...</p>
        </div>
      </DemoShell>
    )
  }

  const grouped = groupedTimeline()

  return (
    <DemoShell title="Patient Timeline">
      <div className="space-y-6">
        {/* Patient Selector */}
        {persons.length > 1 && (
          <div className="rounded-lg border bg-card p-4">
            <label className="block text-sm font-semibold mb-2">Select Patient</label>
            <div className="flex flex-wrap gap-2">
              {persons.map(person => (
                <button
                  key={person.id}
                  onClick={() => setSelectedPerson(person)}
                  className={`px-4 py-2 rounded border text-sm font-medium transition-colors ${
                    selectedPerson?.id === person.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-accent"
                  }`}
                >
                  {person.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Patient Info */}
        {selectedPerson && (
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold">{selectedPerson.name}</h2>
                <div className="mt-2 flex flex-wrap gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">SYNAPSE ID:</span>{" "}
                    <span className="font-semibold">{selectedPerson.synapseId}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Age:</span>{" "}
                    <span className="font-semibold">
                      {selectedPerson.dateOfBirth 
                        ? new Date().getFullYear() - new Date(selectedPerson.dateOfBirth).getFullYear() 
                        : "?"} years
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Sex:</span>{" "}
                    <span className="font-semibold">{selectedPerson.sex}</span>
                  </div>
                </div>
              </div>
              {selectedPerson.synthetic && (
                <span className="px-3 py-1 rounded text-xs font-semibold bg-orange-500/10 text-orange-500 border border-orange-500/20">
                  SYNTHETIC
                </span>
              )}
            </div>
          </div>
        )}

        {/* View Options */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={groupByEncounter}
              onChange={(e) => setGroupByEncounter(e.target.checked)}
              className="w-4 h-4"
            />
            <span>Group by Encounter</span>
          </label>
          <span className="text-muted-foreground">·</span>
          <span className="text-sm text-muted-foreground">
            {timeline.length} event{timeline.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Timeline */}
        {timeline.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
            <p className="text-4xl mb-2">📅</p>
            <p>No timeline events yet</p>
            <p className="text-sm mt-2">Start a visit to see events here</p>
          </div>
        ) : groupByEncounter && grouped ? (
          <div className="space-y-6">
            {Object.entries(grouped).map(([encounterId, events]: [string, any[]]) => {
              const encounter = encounters.find(e => e.id === encounterId)
              return (
                <div key={encounterId} className="rounded-lg border bg-card overflow-hidden">
                  {/* Encounter Header */}
                  {encounter ? (
                    <div className="p-4 border-b bg-accent">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{encounter.visitType} Visit</h3>
                          <p className="text-sm text-muted-foreground">
                            {encounter.encounterType.toUpperCase()} · {encounter.paymentCategory}
                          </p>
                          {encounter.complaint && (
                            <p className="text-sm mt-1">
                              <span className="text-muted-foreground">CC:</span> {encounter.complaint}
                            </p>
                          )}
                        </div>
                        <div className="text-right text-sm">
                          <p className="font-mono text-xs text-muted-foreground">
                            {encounterId.slice(0, 8)}
                          </p>
                          <span className={`inline-block mt-1 px-2 py-1 rounded text-xs font-semibold ${
                            encounter.status === "active" ? "bg-green-500/10 text-green-500" :
                            encounter.status === "completed" ? "bg-gray-500/10 text-gray-500" :
                            "bg-blue-500/10 text-blue-500"
                          }`}>
                            {encounter.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : encounterId === "system" ? (
                    <div className="p-4 border-b bg-accent">
                      <h3 className="font-semibold">System Events</h3>
                    </div>
                  ) : null}

                  {/* Events in this encounter */}
                  <div className="divide-y">
                    {events.map((event: any) => (
                      <div key={event.id} className="p-4 hover:bg-accent/50 transition-colors">
                        <div className="flex items-start gap-3">
                          <span className={`text-2xl ${getEventColor(event.eventType)}`}>
                            {getEventIcon(event.eventType)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <p className="font-semibold">{event.title}</p>
                                {event.description && (
                                  <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                                )}
                                <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                                  <span>{formatDate(event.createdAt)}</span>
                                  <span>{event.facilityId === "demo-lab" ? "Demo Lab" : event.facilityId === "demo-pharmacy" ? "Demo Pharmacy" : "Demo Hospital"}</span>
                                  <span>{event.actorId}</span>
                                  <span>{event.eventType}</span>
                                </div>
                              </div>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatDate(event.createdAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="divide-y">
              {timeline.map((event: any) => (
                <div key={event.id} className="p-4 hover:bg-accent/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className={`text-2xl ${getEventColor(event.eventType)}`}>
                      {getEventIcon(event.eventType)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-semibold">{event.title}</p>
                          {event.description && (
                            <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                          )}
                          <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                            <span>🏥 {event.facilityId}</span>
                            <span>👤 {event.actorId}</span>
                            {event.encounterId && (
                              <span className="font-mono">Encounter: {event.encounterId.slice(0, 8)}</span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDate(event.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary Stats */}
        {timeline.length > 0 && (
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold mb-4">Timeline Summary</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{encounters.filter(e => e.personId === selectedPerson?.id).length}</p>
                <p className="text-sm text-muted-foreground">Encounters</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{timeline.length}</p>
                <p className="text-sm text-muted-foreground">Events</p>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {timeline.filter((e: any) => e.eventType.includes("lab")).length}
                </p>
                <p className="text-sm text-muted-foreground">Lab Events</p>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {timeline.filter((e: any) => e.eventType.includes("prescription")).length}
                </p>
                <p className="text-sm text-muted-foreground">Rx Events</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </DemoShell>
  )
}
