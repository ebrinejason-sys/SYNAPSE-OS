"use client"

import { DEMO_ROUTES, demoHref } from "../../../lib/demo/paths"
import { applyStationSession, DEMO_STATIONS, stationHref } from "../../../lib/demo/stations"
import { DemoMast } from "../../../components/demo/DemoMast"
import { DemoThemeControl } from "../../../components/demo/DemoThemeControl"

const STATION_COPY: Record<string, string> = {
  reception: "Register the synthetic patient and start an OPD visit.",
  nurse: "Record vitals, triage, and send onward to the doctor.",
  doctor: "Document, order labs, diagnose, and prescribe.",
  lab: "Accept, collect, enter, then verify and release results.",
  review: "Return after Lab with released results.",
  pharmacist: "Review the prescription, pick the FEFO batch, dispense.",
  billing: "Invoice, record payment, and close the visit.",
  timeline: "See Hospital, Lab, and Pharmacy on one chart.",
}

export default function DemoLoginPage() {
  return (
    <main className="min-h-screen">
      <DemoMast badge="TEST DRIVE / SYNTHETIC">
        <a
          href={DEMO_ROUTES.guide}
          className="font-mono text-xs uppercase tracking-wider"
          style={{ color: "var(--text-secondary)" }}
          onClick={(event) => {
            event.preventDefault()
            window.location.assign(demoHref("guide"))
          }}
        >
          Guide
        </a>
        <DemoThemeControl />
      </DemoMast>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <section className="demo-hero">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em]" style={{ color: "var(--text-muted)" }}>
            SYNTHETIC TEST DRIVE
          </p>
          <h1 className="font-display mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            Take a station
          </h1>
          <p className="mt-3 max-w-2xl text-base" style={{ color: "var(--text-secondary)" }}>
            Choosing a station also switches the Test Drive role. No real patient data.
          </p>
          <p className="mt-2 text-sm font-medium" style={{ color: "var(--brand-orange)" }}>
            DO NOT ENTER REAL PATIENT DATA
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a className="demo-btn-primary inline-flex items-center justify-center" href={stationHref("reception")} onClick={() => applyStationSession("reception")}>
              Recommended start: Reception
            </a>
            <a className="demo-btn-secondary inline-flex items-center justify-center" href={stationHref("reception")} onClick={() => applyStationSession("reception")}>
              Start Golden Journey
            </a>
          </div>
          <p className="mt-3 text-sm" style={{ color: "var(--text-secondary)" }}>
            Follow one synthetic patient through the full eight-step care journey.
          </p>
        </section>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {DEMO_STATIONS.map((station) => (
            <a
              key={station.id}
              className="demo-card p-4 text-left"
              href={stationHref(station.id)}
              onClick={() => applyStationSession(station.id)}
            >
              <h2 className="text-lg font-bold">{station.label}</h2>
              <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
                {STATION_COPY[station.id]}
              </p>
            </a>
          ))}
        </div>

        <p className="mt-6 text-xs" style={{ color: "var(--text-muted)" }}>
          Explore{" "}
          <button type="button" className="underline" onClick={() => window.location.assign(demoHref("admin"))}>
            Admin
          </button>
          {" · "}
          <button type="button" className="underline" onClick={() => window.location.assign(demoHref("network"))}>
            Network
          </button>
          {" · "}
          <button type="button" className="underline" onClick={() => window.location.assign(demoHref("guide"))}>
            Guide
          </button>
        </p>
      </div>
    </main>
  )
}
