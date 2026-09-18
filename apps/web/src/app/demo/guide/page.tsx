"use client";

import { DEMO_ROUTES, demoHref } from "../../../lib/demo/paths";
import { DemoMast } from "../../../components/demo/DemoMast";

const STEPS = [
  {
    number: 1,
    role: "Reception",
    route: "/demo/reception",
    title: "Register Amina Demo",
    description: "Find or register the demo patient, verify demographics, generate Synapse ID, start encounter, and queue for triage.",
    details: [
      "Search for 'Amina Demo' or create new registration",
      "Verify: Name, DOB, Sex, Contact",
      "System generates Synapse ID (canonical person identity)",
      "Start OPD encounter → patient enters queue",
    ],
  },
  {
    number: 2,
    role: "Nurse",
    route: "/demo/nurse",
    title: "Record Triage & Vitals",
    description: "Open nursing worklist, select Amina, record vital signs and triage assessment.",
    details: [
      "Open nursing board → worklist shows queued patients",
      "Select Amina → record: Temp, HR, BP, SpO₂, RR",
      "Triage category: Emergency / Urgent / Standard",
      "Send to Doctor queue",
    ],
  },
  {
    number: 3,
    role: "Doctor",
    route: "/demo/doctor",
    title: "Clinical Encounter & Lab Order",
    description: "Complete the clinical write-up and order a lab test.",
    details: [
      "Open Amina's encounter",
      "Chief Complaint, HPI, PMH, Allergies, Medications, ROS",
      "General & Systemic Examination",
      "Assessment → Differential Diagnosis",
      "Order Lab: e.g., Malaria RDT, CBC",
      "Sign encounter note",
    ],
  },
  {
    number: 4,
    role: "Lab",
    route: "/demo/lab",
    title: "Process Lab Order",
    description: "Receive the external order, accession, collect specimen, enter result, verify, and release.",
    details: [
      "Worklist shows new order from hospital",
      "Accession → assign lab number",
      "Specimen collection: record collector, time, type",
      "Demonstrate reject/recollect if desired",
      "Enter result (manual or analyzer)",
      "Scientist verifies → release final report",
    ],
  },
  {
    number: 5,
    role: "Doctor",
    route: "/demo/doctor",
    title: "Review Result & Prescribe",
    description: "See released result, acknowledge, confirm diagnosis, ICD-11 code, treatment plan, prescribe.",
    details: [
      "Result appears in clinician inbox",
      "Acknowledge result",
      "Confirm diagnosis → select ICD-11 code",
      "Treatment plan",
      "Prescribe medication (e.g., Artemether-Lumefantrine)",
      "Sign updated encounter",
    ],
  },
  {
    number: 6,
    role: "Pharmacist",
    route: "/demo/pharmacist",
    title: "Verify & Dispense",
    description: "Receive prescription, verify, select batch (FEFO), dispense, stock decrement, print receipt.",
    details: [
      "Prescription queue shows new Rx",
      "Verify: dose, frequency, duration, interactions",
      "Select batch → FEFO (First Expired, First Out)",
      "Dispense → stock decrements exactly once",
      "Print receipt / medication event recorded",
    ],
  },
  {
    number: 7,
    role: "Reception",
    route: "/demo/billing",
    title: "Billing & Disposition",
    description: "Review accumulated charges, settle payment, close encounter.",
    details: [
      "Encounter shows: consultation, lab, pharmacy charges",
      "Generate invoice",
      "Record payment (cash/insurance demo)",
      "Disposition: Home / Admit / Refer",
      "Close encounter",
    ],
  },
  {
    number: 8,
    role: "Any",
    route: "/demo/timeline",
    title: "Review Longitudinal Timeline",
    description: "See the complete care journey under ONE person identity.",
    details: [
      "Registration → Triage → Encounter",
      "Lab Order → Lab Result",
      "Diagnosis (ICD-11) → Prescription",
      "Dispense → Billing → Disposition",
      "All linked to Amina's Synapse ID",
    ],
  },
];

export default function DemoGuidePage() {
  return (
    <main className="min-h-screen">
      <DemoMast badge="TEST DRIVE GUIDE">
        <a
          href={DEMO_ROUTES.login}
          className="font-mono text-xs uppercase tracking-wider"
          style={{ color: "var(--brand-orange)" }}
          onClick={(event) => {
            event.preventDefault()
            window.location.assign(demoHref("login"))
          }}
        >
          Start Test Drive
        </a>
      </DemoMast>

      <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        <div className="text-center mb-10">
          <h1 className="font-display font-bold text-3xl sm:text-4xl mb-4" style={{ letterSpacing: "-0.02em" }}>
            Tester Guide — Golden Journey
          </h1>
          <p className="text-lg" style={{ color: "var(--text-secondary)" }}>
            Follow these 8 steps to experience the connected SYNAPSE workflow.
            Switch roles at each step using the role switcher (bottom-left in demo mode).
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
            All data is synthetic. Patient <strong>Amina Demo</strong> is generated via the real Synapse ID system.
            Facility: <strong>SYNAPSE Demo Hospital</strong>. Lab: <strong>SYNAPSE Demo Lab</strong>. Pharmacy: <strong>SYNAPSE Demo Pharmacy</strong>.
          </p>
        </div>

        <div className="space-y-6">
          {STEPS.map((step) => (
            <div
              key={step.number}
              className="group p-6 rounded-2xl transition-all"
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border-edge)" }}
            >
              <div className="flex items-start gap-4 mb-4">
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg"
                  style={{ background: "var(--brand-orange)", color: "#07070A" }}
                >
                  {step.number}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="font-bold text-xl" style={{ color: "var(--text-primary)" }}>
                      Step {step.number}: {step.title}
                    </h2>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(249,115,22,0.15)", color: "var(--brand-orange)", border: "1px solid var(--border-orange)" }}
                    >
                      {step.role}
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{step.description}</p>
                </div>
                <a
                  href={step.route}
                  className="shrink-0 px-3 py-1.5 text-sm font-semibold rounded-xl transition-opacity opacity-0 group-hover:opacity-100"
                  style={{ background: "var(--brand-orange)", color: "#07070A", textDecoration: "none" }}
                >
                  Open →
                </a>
              </div>
              <div className="ml-14 space-y-1.5">
                {step.details.map((detail, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                    <span style={{ color: "var(--brand-orange)" }}>→</span>
                    <span>{detail}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 p-6 rounded-2xl" style={{ background: "var(--bg-surface)", border: "1px solid var(--border-orange)" }}>
          <h3 className="font-bold mb-3" style={{ color: "var(--brand-orange)" }}>Quick Tips</h3>
          <ul className="space-y-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            <li>• Use the <strong>role switcher</strong> (bottom-left floating button) to change roles without logging out</li>
            <li>• Click <strong>Reset Demo Journey</strong> in the switcher to clear all synthetic data and start fresh</li>
            <li>• The demo uses <strong>short-lived synthetic sessions</strong> — no real passwords stored</li>
            <li>• Try <strong>offline mode</strong>: disconnect network, make changes, reconnect to see sync</li>
            <li>• Check the <strong>patient timeline</strong> at any point to see the longitudinal record</li>
          </ul>
        </div>

        <div className="mt-6 text-center">
          <a
            href="/demo/login"
            className="inline-block px-6 py-3 rounded-xl font-bold text-lg"
            style={{ background: "var(--brand-orange)", color: "#07070A", textDecoration: "none" }}
          >
            Start Test Drive →
          </a>
        </div>

        <p className="mt-6 text-xs text-center" style={{ color: "var(--text-muted)" }}>
          Build: <code id="build-sha">loading…</code> | 
          <a href="/demo/feedback" className="underline" style={{ color: "var(--brand-orange)" }}>Report a Problem</a> |
          <a href="/" className="underline" style={{ color: "var(--text-muted)" }}>Back to Home</a>
        </p>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                const sha = localStorage.getItem('synapse_build_sha') || 'unknown';
                document.getElementById('build-sha').textContent = sha.slice(0, 8);
              } catch (e) {}
            })();
          `,
        }}
      />
    </main>
  );
}