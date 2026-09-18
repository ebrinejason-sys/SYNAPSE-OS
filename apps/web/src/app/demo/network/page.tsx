"use client"

import { useState, useEffect } from "react"
import { DemoShell } from "../../../components/demo/DemoShell"
import { getExchangeEvents, getFacilities, getPersons } from "../../../lib/demo/browser-repository"

export default function DemoNetworkPage() {
  const [events, setEvents] = useState<any[]>([])
  const [facilities, setFacilities] = useState<any[]>([])
  const [persons, setPersons] = useState<any[]>([])
  const [selectedFacility, setSelectedFacility] = useState<string>("all")
  const [selectedType, setSelectedType] = useState<string>("all")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [evts, facs, ppl] = await Promise.all([
        getExchangeEvents(),
        getFacilities(),
        getPersons()
      ])
      
      // Sort by createdAt descending (newest first)
      const sorted = evts.sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      
      setEvents(sorted)
      setFacilities(facs)
      setPersons(ppl)
    } catch (error) {
      console.error("Failed to load exchange events:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredEvents = events.filter(event => {
    if (selectedFacility !== "all" && 
        event.sourceFacilityId !== selectedFacility && 
        event.destinationFacilityId !== selectedFacility) {
      return false
    }
    if (selectedType !== "all" && event.type !== selectedType) {
      return false
    }
    return true
  })

  const eventTypes = Array.from(new Set(events.map(e => e.type)))

  const getEventIcon = (type: string) => {
    const icons: Record<string, string> = {
      lab_order: "🧪",
      lab_result: "📊",
      prescription: "💊",
      referral: "🔄",
      transfer: "🚑",
      payment: "💰"
    }
    return icons[type] || "📨"
  }

  const getEventColor = (type: string) => {
    const colors: Record<string, string> = {
      lab_order: "text-purple-500",
      lab_result: "text-blue-500",
      prescription: "text-pink-500",
      referral: "text-orange-500",
      transfer: "text-red-500",
      payment: "text-green-500"
    }
    return colors[type] || "text-gray-500"
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-500/10 text-yellow-500",
      delivered: "bg-green-500/10 text-green-500",
      acknowledged: "bg-blue-500/10 text-blue-500",
      failed: "bg-red-500/10 text-red-500"
    }
    return colors[status] || "bg-gray-500/10 text-gray-500"
  }

  const getFacilityName = (id: string) => {
    const facility = facilities.find(f => f.id === id)
    return facility?.name || id
  }

  const getFacilityIcon = (id: string) => {
    const facility = facilities.find(f => f.id === id)
    const icons: Record<string, string> = {
      hospital: "🏥",
      clinic: "🏥",
      laboratory: "🧪",
      pharmacy: "💊"
    }
    return icons[facility?.type || ""] || "🏢"
  }

  const getPersonName = (id: string) => {
    const person = persons.find(p => p.id === id)
    return person?.name || id
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString()
  }

  const stats = {
    total: events.length,
    pending: events.filter(e => e.status === "pending").length,
    delivered: events.filter(e => e.status === "delivered").length,
    acknowledged: events.filter(e => e.status === "acknowledged").length,
    failed: events.filter(e => e.status === "failed").length,
    byType: eventTypes.reduce((acc, type) => {
      acc[type] = events.filter(e => e.type === type).length
      return acc
    }, {} as Record<string, number>)
  }

  if (loading) {
    return (
      <DemoShell title="Network View">
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          <p>Loading...</p>
        </div>
      </DemoShell>
    )
  }

  return (
    <DemoShell title="Network View">
      <div className="space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div className="rounded-lg border bg-card p-4 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-sm text-muted-foreground">Total Events</p>
          </div>
          <div className="rounded-lg border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-yellow-500">{stats.pending}</p>
            <p className="text-sm text-muted-foreground">Pending</p>
          </div>
          <div className="rounded-lg border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-green-500">{stats.delivered}</p>
            <p className="text-sm text-muted-foreground">Delivered</p>
          </div>
          <div className="rounded-lg border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-blue-500">{stats.acknowledged}</p>
            <p className="text-sm text-muted-foreground">Acknowledged</p>
          </div>
          <div className="rounded-lg border bg-card p-4 text-center">
            <p className="text-2xl font-bold text-red-500">{stats.failed}</p>
            <p className="text-sm text-muted-foreground">Failed</p>
          </div>
        </div>

        {/* Facility Network Diagram */}
        <div className="rounded-lg border bg-card p-6">
          <h2 className="font-semibold text-lg mb-4">Facility Network</h2>
          <div className="flex flex-wrap justify-center gap-8">
            {facilities.map(facility => (
              <div key={facility.id} className="text-center">
                <div className="w-20 h-20 rounded-full bg-accent flex items-center justify-center text-4xl mb-2">
                  {getFacilityIcon(facility.id)}
                </div>
                <p className="text-sm font-semibold">{facility.name}</p>
                <p className="text-xs text-muted-foreground">{facility.type}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {events.filter(e => 
                    e.sourceFacilityId === facility.id || e.destinationFacilityId === facility.id
                  ).length} events
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Filter by Facility</label>
              <select
                value={selectedFacility}
                onChange={(e) => setSelectedFacility(e.target.value)}
                className="px-3 py-2 rounded border bg-background"
              >
                <option value="all">All Facilities</option>
                {facilities.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Filter by Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-3 py-2 rounded border bg-background"
              >
                <option value="all">All Types</option>
                {eventTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            Showing {filteredEvents.length} of {events.length} events
          </p>
        </div>

        {/* Exchange Events */}
        {filteredEvents.length === 0 ? (
          <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
            <p className="text-4xl mb-2">🌐</p>
            <p>No exchange events</p>
            <p className="text-sm mt-2">Order labs or write prescriptions to see inter-facility events</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEvents.map(event => (
              <div key={event.id} className="rounded-lg border bg-card p-4 hover:bg-accent/50 transition-colors">
                <div className="flex items-start gap-4">
                  <span className={`text-3xl ${getEventColor(event.type)}`}>
                    {getEventIcon(event.type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg capitalize">{event.type.replace(/_/g, " ")}</h3>
                        <p className="text-sm text-muted-foreground">
                          Patient: {getPersonName(event.personId)}
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(event.status)}`}>
                        {event.status}
                      </span>
                    </div>

                    {/* Source and Destination */}
                    <div className="flex items-center gap-2 text-sm mb-3">
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-background">
                        <span>{getFacilityIcon(event.sourceFacilityId)}</span>
                        <span className="font-medium">{getFacilityName(event.sourceFacilityId)}</span>
                      </div>
                      <span className="text-muted-foreground">→</span>
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-background">
                        <span>{getFacilityIcon(event.destinationFacilityId)}</span>
                        <span className="font-medium">{getFacilityName(event.destinationFacilityId)}</span>
                      </div>
                    </div>

                    {/* Payload Details */}
                    {event.payload && Object.keys(event.payload).length > 0 && (
                      <details className="mt-2">
                        <summary className="text-sm font-medium cursor-pointer text-muted-foreground hover:text-foreground">
                          View Payload Details
                        </summary>
                        <div className="mt-2 p-3 rounded bg-background">
                          <pre className="text-xs overflow-x-auto">
                            {JSON.stringify(event.payload, null, 2)}
                          </pre>
                        </div>
                      </details>
                    )}

                    {/* Metadata */}
                    <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
                      <span>👤 {event.actorId}</span>
                      {event.encounterId && (
                        <span className="font-mono">Encounter: {event.encounterId.slice(0, 8)}</span>
                      )}
                      <span>📅 {formatDate(event.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Event Type Breakdown */}
        {events.length > 0 && (
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold mb-4">Event Type Breakdown</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {Object.entries(stats.byType).map(([type, count]) => (
                <div key={type} className="flex items-center gap-3 p-3 rounded bg-background">
                  <span className={`text-2xl ${getEventColor(type)}`}>
                    {getEventIcon(type)}
                  </span>
                  <div>
                    <p className="font-semibold">{count}</p>
                    <p className="text-xs text-muted-foreground capitalize">{type.replace(/_/g, " ")}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <span>ℹ️</span>
            <span>About Exchange Events</span>
          </h3>
          <p className="text-sm text-muted-foreground">
            Exchange events represent inter-facility communication in the SYNAPSE ecosystem. 
            When a doctor orders lab tests, the order is sent as an exchange event from the 
            hospital to the lab facility. Similarly, prescriptions are sent to the pharmacy, 
            and results are sent back to the ordering facility.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            This demonstrates the connected-care workflow where patient data flows securely 
            between facilities while maintaining provenance and audit trails.
          </p>
        </div>
      </div>
    </DemoShell>
  )
}
