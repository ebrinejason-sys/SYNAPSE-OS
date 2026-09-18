"use client";

import { useState } from "react";
import { SynapseLogo } from "../../../components/SynapseLogo";

const ROLES = [
  {
    id: "reception",
    label: "Enter as Reception",
    description: "Register patients, start encounters, manage queue",
    icon: "👥",
    color: "#3B82F6",
  },
  {
    id: "nurse",
    label: "Enter as Nurse",
    description: "Record vitals, triage patients, send to doctor",
    icon: "🩺",
    color: "#10B981",
  },
  {
    id: "doctor",
    label: "Enter as Doctor",
    description: "Clinical encounter, diagnosis, orders, prescriptions",
    icon: "👨‍⚕️",
    color: "#F59E0B",
  },
  {
    id: "lab",
    label: "Enter as Lab",
    description: "Process orders, enter results, verify and release",
    icon: "🧪",
    color: "#8B5CF6",
  },
  {
    id: "pharmacist",
    label: "Enter as Pharmacist",
    description: "Verify prescriptions, dispense, manage inventory",
    icon: "💊",
    color: "#EC4899",
  },
  {
    id: "cashier",
    label: "Enter as Cashier",
    description: "Invoice charges, take payment, close the visit",
    icon: "💰",
    color: "#0EA5E9",
  },
  {
    id: "admin",
    label: "Enter as Facility Admin",
    description: "Manage staff, view analytics, configure facility",
    icon: "⚙️",
    color: "#6B7280",
  },
] as const;

const ROLE_SESSION: Record<string, { role: string; facilityId: string }> = {
  reception: { role: "reception", facilityId: "demo-hospital" },
  nurse: { role: "nurse", facilityId: "demo-hospital" },
  doctor: { role: "doctor", facilityId: "demo-hospital" },
  lab: { role: "lab_technician", facilityId: "demo-lab" },
  pharmacist: { role: "pharmacist", facilityId: "demo-pharmacy" },
  cashier: { role: "cashier", facilityId: "demo-hospital" },
  admin: { role: "admin", facilityId: "demo-hospital" },
};

export default function DemoLoginPage() {
  const [selectedRole, setSelectedRole] = useState<typeof ROLES[0] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(roleId: string) {
    setLoading(true);
    setError(null);
    try {
      const session = ROLE_SESSION[roleId] ?? { role: "reception", facilityId: "demo-hospital" }
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 4000)
      const response = await fetch("/api/demo/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: roleId === "lab" ? "lab" : session.role }),
        signal: controller.signal,
      }).catch(() => null)
      window.clearTimeout(timeout)
      if (response && !response.ok && response.status !== 403 && response.status !== 503) throw new Error("Demo session unavailable")
      sessionStorage.setItem("synapse_demo_role", session.role);
      sessionStorage.setItem("synapse_demo_facility", session.facilityId);
      sessionStorage.setItem("synapse_demo_mode", "true");
      window.location.href = "/demo/workspace";
    } catch (e) {
      setError("Failed to start demo session. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg-base)", color: "var(--text-primary)" }}>
      <header
        className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4"
        style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--nav-glass)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 10 }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <SynapseLogo size="sm" />
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-md shrink-0"
            style={{ background: "rgba(249,115,22,0.15)", color: "var(--brand-orange)", border: "1px solid var(--border-orange)" }}
          >
            SYNTHETIC DEMO
          </span>
        </div>
        <a href="/demo/guide" className="shrink-0 text-sm" style={{ color: "var(--text-secondary)" }}>
          View Guide →
        </a>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-12 sm:py-16">
        <div className="text-center mb-12">
          <h1 className="font-display font-bold text-3xl sm:text-4xl mb-4" style={{ letterSpacing: "-0.02em" }}>
            Explore SYNAPSE Test Drive
          </h1>
          <p className="text-lg" style={{ color: "var(--text-secondary)", maxWidth: "600px", margin: "0 auto" }}>
            This is a browser playground, not a live hospital. Choose a role and walk the connected SYNAPSE workflow with synthetic data.
            No real patient records. No production database writes.
          </p>
        </div>

        <div
          className="p-4 rounded-2xl mb-8"
          style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.25)" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span style={{ color: "#EF4444", fontSize: "18px" }}>⚠</span>
            <h3 className="font-bold" style={{ color: "#EF4444" }}>SYNTHETIC DEMO — NO REAL PATIENT DATA</h3>
          </div>
          <p className="text-sm" style={{ color: "#FCA5A5" }}>
            All data in this environment is synthetic. The demo patient <strong>Amina Demo</strong> is a generated identity.
            Actions here do not affect any real systems or patients.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ROLES.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => handleLogin(role.id)}
              disabled={loading}
              className="group p-6 rounded-2xl text-left transition-all relative overflow-hidden"
              style={{
                background: selectedRole?.id === role.id ? `${role.color}15` : "var(--bg-surface)",
                border: `2px solid ${selectedRole?.id === role.id ? role.color : "var(--border-edge)"}`,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                  style={{ background: `${role.color}15`, color: role.color }}
                >
                  {role.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg truncate" style={{ color: "var(--text-primary)" }}>
                    {role.label}
                  </h3>
                  <p className="text-sm mt-1 truncate" style={{ color: "var(--text-secondary)" }}>
                    {role.description}
                  </p>
                </div>
              </div>
              {selectedRole?.id === role.id && (
                <div className="absolute inset-0" style={{ background: `${role.color}05` }} />
              )}
            </button>
          ))}
        </div>

        {error && (
          <div
            className="mt-6 px-4 py-3 rounded-xl text-sm text-center"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#EF4444" }}
          >
            {error}
          </div>
        )}

        <div className="mt-10 pt-6 border-t" style={{ borderColor: "var(--border-edge)" }}>
          <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
            This is a synthetic test environment. 
            <a href="/demo/guide" className="underline" style={{ color: "var(--brand-orange)" }}>
              Read the tester guide
            </a>
            {' '}or{' '}
            <a href="/demo/feedback" className="underline" style={{ color: "var(--brand-orange)" }}>
              report a problem
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
