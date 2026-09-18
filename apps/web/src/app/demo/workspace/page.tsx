"use client"

import { useState, useEffect } from "react"
import { DemoShell } from "../../../components/demo/DemoShell"
import Link from "next/link"
import { getQueue, getOrdersByFacility, getPrescriptionsByFacility, getNotificationsByUser, getEncounters } from "../../../lib/demo/browser-repository"

interface WorkspaceItem {
  id: string
  title: string
  subtitle: string
  status: string
  link: string
  priority?: string
}

export default function DemoWorkspacePage() {
  const [role, setRole] = useState<string>("")
  const [facility, setFacility] = useState<string>("")
  const [items, setItems] = useState<WorkspaceItem[]>([])
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadWorkspace()
  }, [])

  async function loadWorkspace() {
    const storedRole = sessionStorage.getItem("synapse_demo_role") || "doctor"
    const storedFacility = sessionStorage.getItem("synapse_demo_facility") || "demo-hospital"
    setRole(storedRole)
    setFacility(storedFacility)

    const userId = `${storedRole}-demo`
    
    try {
      const [queue, orders, prescriptions, notifs] = await Promise.all([
        getQueue(),
        getOrdersByFacility(storedFacility),
        getPrescriptionsByFacility(storedFacility),
        getNotificationsByUser(userId)
      ])

      setNotifications(notifs.filter(n => !n.read).slice(0, 5))

      // Build role-specific work items
      const workItems: WorkspaceItem[] = []

      if (storedRole === "reception") {
        // Show patients in reception queue
        const receptionQueue = queue.filter(q => q.queueType === "reception" && q.status === "waiting")
        workItems.push(...receptionQueue.map(q => ({
          id: q.id,
          title: "New patient registration",
          subtitle: q.encounterId,
          status: q.priority,
          link: "/demo/reception",
          priority: q.priority
        })))
      }

      if (storedRole === "nurse") {
        // Show patients in triage queue
        const triageQueue = queue.filter(q => q.queueType === "triage" && q.status === "waiting")
        workItems.push(...triageQueue.map(q => ({
          id: q.id,
          title: "Triage assessment needed",
          subtitle: `Encounter: ${q.encounterId.slice(0, 8)}`,
          status: q.priority,
          link: "/demo/nurse",
          priority: q.priority
        })))
      }

      if (storedRole === "doctor") {
        // Show patients in doctor queue
        const doctorQueue = queue.filter(q => q.queueType === "doctor" && q.status === "waiting")
        workItems.push(...doctorQueue.map(q => ({
          id: q.id,
          title: "Patient consultation",
          subtitle: `Encounter: ${q.encounterId.slice(0, 8)}`,
          status: q.priority,
          link: "/demo/doctor",
          priority: q.priority
        })))
      }

      if (storedRole === "lab_technician" || storedRole === "lab_scientist") {
        // Show pending lab orders
        const pendingOrders = orders.filter(o => 
          o.orderType === "lab" && 
          ["ordered", "acknowledged", "collected"].includes(o.status)
        )
        workItems.push(...pendingOrders.map(o => ({
          id: o.id,
          title: o.testName,
          subtitle: `Order from ${o.sourceFacilityId}`,
          status: o.status,
          link: "/demo/lab",
          priority: o.priority
        })))
      }

      if (storedRole === "pharmacist") {
        // Show pending prescriptions
        const pendingRx = prescriptions.filter(p => p.status === "active")
        workItems.push(...pendingRx.map(p => ({
          id: p.id,
          title: `${p.medicationName} ${p.strength}`,
          subtitle: `${p.quantity} ${p.form}`,
          status: p.status,
          link: "/demo/pharmacist",
          priority: "routine"
        })))
      }

      if (storedRole === "cashier") {
        // Show pending invoices
        const allEncounters = await getEncounters()
        const activeEncounters = allEncounters.filter(e => e.status === "active")
        workItems.push(...activeEncounters.slice(0, 5).map(e => ({
          id: e.id,
          title: "Pending billing",
          subtitle: `${e.visitType} · ${e.paymentCategory}`,
          status: e.status,
          link: "/demo/billing",
          priority: "routine"
        })))
      }

      setItems(workItems)
    } catch (error) {
      console.error("Failed to load workspace:", error)
    } finally {
      setLoading(false)
    }
  }

  const roleConfig = {
    reception: {
      icon: "👥",
      color: "#3B82F6",
      title: "Reception Workspace",
      actions: [
        { label: "Register New Patient", href: "/demo/reception", icon: "➕" },
        { label: "Search Patients", href: "/demo/patient", icon: "🔍" },
      ]
    },
    nurse: {
      icon: "🩺",
      color: "#10B981",
      title: "Nurse Workspace",
      actions: [
        { label: "Triage Queue", href: "/demo/nurse", icon: "📋" },
        { label: "Vitals Entry", href: "/demo/nurse", icon: "❤️" },
      ]
    },
    doctor: {
      icon: "👨‍⚕️",
      color: "#F59E0B",
      title: "Doctor Workspace",
      actions: [
        { label: "Patient Queue", href: "/demo/doctor", icon: "📋" },
        { label: "Clinical Workspace", href: "/demo/doctor", icon: "📝" },
      ]
    },
    lab_technician: {
      icon: "🧪",
      color: "#8B5CF6",
      title: "Lab Technician Workspace",
      actions: [
        { label: "Lab Worklist", href: "/demo/lab", icon: "📋" },
        { label: "Specimen Collection", href: "/demo/lab", icon: "🧪" },
      ]
    },
    lab_scientist: {
      icon: "🔬",
      color: "#8B5CF6",
      title: "Lab Scientist Workspace",
      actions: [
        { label: "Results Verification", href: "/demo/lab", icon: "✅" },
        { label: "Lab Worklist", href: "/demo/lab", icon: "📋" },
      ]
    },
    pharmacist: {
      icon: "💊",
      color: "#EC4899",
      title: "Pharmacist Workspace",
      actions: [
        { label: "Prescription Queue", href: "/demo/pharmacist", icon: "📋" },
        { label: "Point of Sale", href: "/demo/pharmacist", icon: "🛒" },
        { label: "Inventory", href: "/demo/pharmacist", icon: "📦" },
      ]
    },
    cashier: {
      icon: "💰",
      color: "#6B7280",
      title: "Cashier Workspace",
      actions: [
        { label: "Billing Queue", href: "/demo/billing", icon: "📋" },
        { label: "Process Payment", href: "/demo/billing", icon: "💳" },
      ]
    },
    admin: {
      icon: "⚙️",
      color: "#6B7280",
      title: "Admin Workspace",
      actions: [
        { label: "All Workflows", href: "/demo/workspace", icon: "📊" },
        { label: "Timeline View", href: "/demo/timeline", icon: "📅" },
        { label: "Network View", href: "/demo/network", icon: "🌐" },
      ]
    }
  }

  const config = roleConfig[role as keyof typeof roleConfig] || roleConfig.admin

  const priorityColor = {
    routine: "bg-blue-500/10 text-blue-500",
    urgent: "bg-orange-500/10 text-orange-500",
    emergency: "bg-red-500/10 text-red-500",
    stat: "bg-red-500/10 text-red-500"
  }

  return (
    <DemoShell title={config.title}>
      <div className="space-y-6">
        {/* Notifications */}
        {notifications.length > 0 && (
          <div className="rounded-lg border border-orange-500/20 bg-orange-500/10 p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <span>🔔</span>
              <span>Notifications ({notifications.length})</span>
            </h3>
            <div className="space-y-2">
              {notifications.map(n => (
                <div key={n.id} className="flex items-start gap-2 text-sm">
                  <span className="text-orange-500">•</span>
                  <div>
                    <p className="font-medium">{n.title}</p>
                    <p className="text-muted-foreground text-xs">{n.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {config.actions.map(action => (
            <Link
              key={action.href}
              href={action.href}
              className="block p-6 rounded-lg border bg-card hover:bg-accent transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{action.icon}</span>
                <div>
                  <p className="font-semibold">{action.label}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Work Queue */}
        <div className="rounded-lg border bg-card">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-lg">My Work Queue</h2>
          </div>
          <div className="divide-y">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">
                <p>Loading...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <p className="text-4xl mb-2">✅</p>
                <p>No pending items</p>
                <p className="text-sm mt-1">All caught up!</p>
              </div>
            ) : (
              items.map(item => (
                <Link
                  key={item.id}
                  href={item.link}
                  className="block p-4 hover:bg-accent transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.title}</p>
                      <p className="text-sm text-muted-foreground truncate">{item.subtitle}</p>
                    </div>
                    {item.priority && (
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${priorityColor[item.priority as keyof typeof priorityColor] || "bg-gray-500/10 text-gray-500"}`}>
                        {item.priority}
                      </span>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Getting Started Guide */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <span>📚</span>
            <span>Quick Guide</span>
          </h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            {role === "reception" && (
              <>
                <p>1. Register a new patient or search for existing patient</p>
                <p>2. Start a visit encounter (OPD, Emergency, etc.)</p>
                <p>3. Collect payment category (Cash, Insurance, etc.)</p>
                <p>4. Send patient to Triage queue</p>
              </>
            )}
            {role === "nurse" && (
              <>
                <p>1. Record vitals: Temperature, HR, BP, RR, SpO₂, Weight, Height</p>
                <p>2. Assess pain score (0-10)</p>
                <p>3. Assign triage category: Red (Emergency), Orange (Urgent), Yellow, Green (Routine)</p>
                <p>4. Send patient to Doctor queue</p>
              </>
            )}
            {role === "doctor" && (
              <>
                <p>1. Review triage data and vitals</p>
                <p>2. Complete clinical documentation: CC, HPI, Exam, Assessment</p>
                <p>3. Order lab tests if needed (sends to Lab facility)</p>
                <p>4. Write prescriptions (sends to Pharmacy facility)</p>
                <p>5. Sign clinical note when complete</p>
              </>
            )}
            {(role === "lab_technician" || role === "lab_scientist") && (
              <>
                <p>1. Accept lab order from worklist</p>
                <p>2. Collect specimen and assign accession number</p>
                <p>3. Enter test results</p>
                <p>4. Lab Scientist: Verify and release results</p>
                <p>5. Results automatically sent back to ordering facility</p>
              </>
            )}
            {role === "pharmacist" && (
              <>
                <p>1. Verify prescription from queue</p>
                <p>2. Check FEFO (First Expiry, First Out) batch selection</p>
                <p>3. Dispense with correct quantity</p>
                <p>4. Print receipt and update inventory</p>
                <p>5. Use POS for over-the-counter sales</p>
              </>
            )}
            {role === "cashier" && (
              <>
                <p>1. Generate invoice from encounter</p>
                <p>2. Add consultation, lab, medication, procedure charges</p>
                <p>3. Apply discounts if applicable</p>
                <p>4. Collect payment (Cash, Mobile Money, Card, Insurance)</p>
                <p>5. Close encounter when fully paid</p>
              </>
            )}
          </div>
        </div>

        {/* Demo Navigation */}
        <div className="rounded-lg border bg-card p-6">
          <h3 className="font-semibold mb-3">Demo Navigation</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <Link href="/demo/reception" className="text-center p-3 rounded hover:bg-accent">
              <div className="text-2xl mb-1">👥</div>
              <div>Reception</div>
            </Link>
            <Link href="/demo/nurse" className="text-center p-3 rounded hover:bg-accent">
              <div className="text-2xl mb-1">🩺</div>
              <div>Nurse</div>
            </Link>
            <Link href="/demo/doctor" className="text-center p-3 rounded hover:bg-accent">
              <div className="text-2xl mb-1">👨‍⚕️</div>
              <div>Doctor</div>
            </Link>
            <Link href="/demo/lab" className="text-center p-3 rounded hover:bg-accent">
              <div className="text-2xl mb-1">🧪</div>
              <div>Lab</div>
            </Link>
            <Link href="/demo/pharmacist" className="text-center p-3 rounded hover:bg-accent">
              <div className="text-2xl mb-1">💊</div>
              <div>Pharmacy</div>
            </Link>
            <Link href="/demo/billing" className="text-center p-3 rounded hover:bg-accent">
              <div className="text-2xl mb-1">💰</div>
              <div>Billing</div>
            </Link>
            <Link href="/demo/timeline" className="text-center p-3 rounded hover:bg-accent">
              <div className="text-2xl mb-1">📅</div>
              <div>Timeline</div>
            </Link>
            <Link href="/demo/network" className="text-center p-3 rounded hover:bg-accent">
              <div className="text-2xl mb-1">🌐</div>
              <div>Network</div>
            </Link>
          </div>
        </div>
      </div>
    </DemoShell>
  )
}
