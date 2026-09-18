"use client";

import { useState } from "react";
import { DEMO_ROUTES, demoHref } from "../../../lib/demo/paths";
import { DemoMast } from "../../../components/demo/DemoMast";

const ROLES = [
  {
    id: "reception",
    code: "01 RX",
    label: "Reception",
    description: "Register patients, start encounters, manage the queue",
    color: "#0F766E",
  },
  {
    id: "nurse",
    code: "02 NS",
    label: "Nurse",
    description: "Record vitals, triage, send to the doctor",
    color: "#0F766E",
  },
  {
    id: "doctor",
    code: "03 MD",
    label: "Doctor",
    description: "Encounter, diagnosis, orders, prescriptions",
    color: "#C2410C",
  },
  {
    id: "lab",
    code: "04 LB",
    label: "Laboratory",
    description: "Process orders, enter results, verify and release",
    color: "#1D4E89",
  },
  {
    id: "pharmacist",
    code: "05 PH",
    label: "Pharmacy",
    description: "Verify prescriptions, dispense, inventory",
    color: "#7C3AED",
  },
  {
    id: "cashier",
    code: "06 CA",
    label: "Cashier",
    description: "Invoice charges, take payment, close the visit",
    color: "#0E7490",
  },
  {
    id: "admin",
    code: "07 AD",
    label: "Facility admin",
    description: "Staff, analytics, facility configuration",
    color: "#334155",
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
      window.location.href = demoHref("workspace");
    } catch (e) {
      setError("Failed to start demo session. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen">
      <DemoMast>
        <a
          href={DEMO_ROUTES.guide}
          className="font-mono text-xs uppercase tracking-wider"
          style={{ color: "var(--text-secondary)" }}
          onClick={(event) => {
            event.preventDefault()
            window.location.assign(demoHref("guide"))
          }}
        >
          How it works
        </a>
      </DemoMast>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <div className="demo-frame p-6 sm:p-8">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em]" style={{ color: "var(--text-muted)" }}>
            Duty roster · SYNAPSE Demo Hospital
          </p>
          <h1 className="font-display mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Take a station
          </h1>
          <p className="mt-3 max-w-2xl text-base" style={{ color: "var(--text-secondary)" }}>
            This is a browser playground, not a live hospital. Choose a role and walk the connected SYNAPSE workflow with synthetic data. No real patient records. No production writes.
          </p>

          <aside className="demo-card mt-6 p-4">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--brand-orange)" }}>
              Synthetic — not for care
            </p>
            <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
              Amina Demo is a generated identity. Actions here do not affect any real systems or patients.
            </p>
          </aside>

          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ROLES.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => handleLogin(role.id)}
                disabled={loading}
                className="demo-card p-5 text-left transition-colors"
                style={{
                  borderColor: selectedRole?.id === role.id ? role.color : undefined,
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                <p className="font-mono text-[10px] font-bold tracking-[0.18em]" style={{ color: role.color }}>{role.code}</p>
                <h2 className="mt-2 text-lg font-bold">{role.label}</h2>
                <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>{role.description}</p>
              </button>
            ))}
            <a
              href={DEMO_ROUTES.guide}
              className="demo-card p-5"
              style={{ textDecoration: "none", color: "inherit" }}
              onClick={(event) => {
                event.preventDefault()
                window.location.assign(demoHref("guide"))
              }}
            >
              <p className="font-mono text-[10px] font-bold tracking-[0.18em]" style={{ color: "var(--brand-orange)" }}>08 GJ</p>
              <h2 className="mt-2 text-lg font-bold">Golden journey</h2>
              <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>Eight stations. One synthetic patient. Read the chart before you start.</p>
            </a>
          </div>

          {error && (
            <div className="demo-card mt-6 p-4 text-sm" style={{ color: "#EF4444" }}>
              {error}
            </div>
          )}

          <p className="mt-8 border-t-2 pt-4 font-mono text-xs" style={{ borderColor: "var(--demo-ink)", color: "var(--text-muted)" }}>
            <a
              href={DEMO_ROUTES.guide}
              className="underline"
              style={{ color: "var(--brand-orange)" }}
              onClick={(event) => {
                event.preventDefault()
                window.location.assign(demoHref("guide"))
              }}
            >
              Read the tester guide
            </a>
            {" · "}
            <a
              href={DEMO_ROUTES.feedback}
              className="underline"
              style={{ color: "var(--brand-orange)" }}
              onClick={(event) => {
                event.preventDefault()
                window.location.assign(demoHref("feedback"))
              }}
            >
              Report a problem
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
