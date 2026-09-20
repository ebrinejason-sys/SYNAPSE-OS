"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

type Device = {
  id: string
  name: string
  manufacturer: string | null
  model: string | null
  serial_number?: string | null
  section?: string | null
  connection_type: string
  protocol: string
  validation_status: string
  active: boolean
  last_seen_at: string | null
  last_message_at: string | null
  operational_health?: string
  coverage?: { mapped: number; unmapped: number; percent: number }
  service_state?: string | null
  queue_summary?: { queueDepth?: number; failedCount?: number }
  credential_prefix?: string | null
}

type Tab = "devices" | "connections" | "mappings" | "messages" | "staging" | "health"

const CONNECTION_TYPES = [
  "SERIAL_RS232", "TCP_CLIENT", "TCP_SERVER", "HL7_MLLP", "ASTM",
  "FILE_WATCH", "CSV_IMPORT", "REST_HTTP", "VENDOR_API", "MANUAL",
]

export default function LabInstrumentsPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>("devices")
  const [name, setName] = useState("")
  const [connectionType, setConnectionType] = useState("ASTM")
  const [serialPort, setSerialPort] = useState("/dev/ttyUSB0")
  const [baudRate, setBaudRate] = useState(9600)
  const [host, setHost] = useState("127.0.0.1")
  const [port, setPort] = useState(9100)
  const [busy, setBusy] = useState(false)
  const [secret, setSecret] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null)

  async function refresh() {
    const res = await fetch("/api/lab/instruments", { cache: "no-store" })
    if (!res.ok) throw new Error("load_failed")
    const data = (await res.json()) as { devices: Device[] }
    setDevices(data.devices ?? [])
  }

  useEffect(() => {
    refresh().catch(() => setError("Unable to load instruments."))
  }, [])

  async function register() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/lab/instruments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          connectionType,
          protocol: connectionType,
          serialPort: connectionType === "SERIAL_RS232" ? serialPort : undefined,
          baudRate: connectionType === "SERIAL_RS232" ? baudRate : undefined,
          host: connectionType !== "SERIAL_RS232" ? host : undefined,
          port: connectionType !== "SERIAL_RS232" ? port : undefined,
        }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Unable to register device")
      setName("")
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to register device")
    } finally {
      setBusy(false)
    }
  }

  async function loadDetail(id: string) {
    setSelected(id)
    const res = await fetch(`/api/lab/instruments/${id}`, { cache: "no-store" })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? "Unable to load device")
      return
    }
    setDetail(data)
  }

  async function rotate(id: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/lab/instruments/${id}/bridge`, { method: "POST" })
      const data = await res.json() as { secret?: string; error?: string; note?: string }
      if (!res.ok) throw new Error(data.error ?? "Unable to issue credential")
      setSecret(data.secret ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to issue credential")
    } finally {
      setBusy(false)
    }
  }

  async function advance(id: string, validationStatus: string) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/lab/instruments/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ validationStatus }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) throw new Error(data.error ?? "Unable to change validation status")
      await refresh()
      await loadDetail(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to change validation status")
    } finally {
      setBusy(false)
    }
  }

  const tabs: { id: Tab; href?: string; label: string }[] = [
    { id: "devices", label: "Devices" },
    { id: "connections", label: "Connections" },
    { id: "mappings", href: "/lab/mappings", label: "Mappings" },
    { id: "messages", label: "Messages" },
    { id: "staging", href: "/lab/staging", label: "Staging" },
    { id: "health", label: "Health" },
  ]

  return (
    <main className="clinical-page p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl">Instruments</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-color">
            Analyzer registry, Lab Edge heartbeat, and mapping coverage. CONNECTED is physical presence, not clinical trust.
            Devices start CONFIGURED and must be promoted through VALIDATION before ACTIVE ingest.
          </p>
        </div>
        <Link href="/lab/orders" className="text-sm text-[#E8B84B] hover:underline">← Worklist</Link>
      </div>

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Instrument sections">
        {tabs.map((item) => item.href ? (
          <Link key={item.id} href={item.href} className="rounded-lg border border-subtle px-3 py-1.5 text-xs">{item.label}</Link>
        ) : (
          <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`rounded-lg border px-3 py-1.5 text-xs ${tab === item.id ? "border-orange-400 bg-orange-500/10" : "border-subtle"}`}>
            {item.label}
          </button>
        ))}
      </nav>

      {error ? <p className="mt-4 text-sm text-amber-300">{error}</p> : null}
      {secret ? (
        <p className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
          Copy this Lab Edge secret now. It will not be shown again: <code className="break-all">{secret}</code>
        </p>
      ) : null}

      {tab === "devices" || tab === "connections" || tab === "health" ? (
        <form className="mt-6 grid gap-3 rounded-2xl border border-subtle bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(event) => { event.preventDefault(); void register() }}>
          <label className="text-xs">Name
            <input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded border border-subtle bg-elevated px-2 py-1" />
          </label>
          <label className="text-xs">Connection
            <select value={connectionType} onChange={(e) => setConnectionType(e.target.value)} className="mt-1 w-full rounded border border-subtle bg-elevated px-2 py-1">
              {CONNECTION_TYPES.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          {connectionType === "SERIAL_RS232" ? (
            <>
              <label className="text-xs">Serial port
                <input value={serialPort} onChange={(e) => setSerialPort(e.target.value)} className="mt-1 w-full rounded border border-subtle bg-elevated px-2 py-1" />
              </label>
              <label className="text-xs">Baud
                <input type="number" value={baudRate} onChange={(e) => setBaudRate(Number(e.target.value))} className="mt-1 w-full rounded border border-subtle bg-elevated px-2 py-1" />
              </label>
            </>
          ) : (
            <>
              <label className="text-xs">Host
                <input value={host} onChange={(e) => setHost(e.target.value)} className="mt-1 w-full rounded border border-subtle bg-elevated px-2 py-1" />
              </label>
              <label className="text-xs">Port
                <input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} className="mt-1 w-full rounded border border-subtle bg-elevated px-2 py-1" />
              </label>
            </>
          )}
          <div className="sm:col-span-2 lg:col-span-4">
            <button type="submit" disabled={busy} className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-black disabled:opacity-50">Register device</button>
          </div>
        </form>
      ) : null}

      {devices.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-subtle p-6 text-sm text-muted-color">
          <p>No instruments registered yet.</p>
          <p className="mt-2">Install Lab Edge on the laboratory LAN, register a device here, issue a bridge credential, then send a simulator message.</p>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {devices.map((d) => (
            <li key={d.id} className="rounded-2xl border border-subtle bg-surface p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <button type="button" className="text-left" onClick={() => void loadDetail(d.id)}>
                  <p className="font-medium">{d.name}</p>
                  <p className="text-xs text-muted-color">
                    {[d.manufacturer, d.model, d.serial_number].filter(Boolean).join(" · ") || "—"} · {d.connection_type} · {d.protocol}
                  </p>
                </button>
                <div className="text-right text-xs">
                  <p className={d.operational_health === "Active" || d.operational_health === "Online" ? "text-emerald-300" : "text-amber-200"}>
                    {d.validation_status} · {d.operational_health ?? "Disconnected"}
                  </p>
                  <p className="text-muted-color">
                    Last heartbeat {d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : "never"} · Last message {d.last_message_at ? new Date(d.last_message_at).toLocaleString() : "never"}
                  </p>
                  <p className="text-muted-color">
                    Mapped {d.coverage?.mapped ?? 0} · Unmapped {d.coverage?.unmapped ?? 0} · Coverage {d.coverage?.percent ?? 0}%
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {["CONNECTED", "VALIDATION", "PILOT", "ACTIVE", "SUSPENDED"].map((status) => (
                  <button key={status} type="button" disabled={busy} onClick={() => void advance(d.id, status)} className="rounded border border-edge px-2 py-1 text-[11px] disabled:opacity-50">
                    {status}
                  </button>
                ))}
                <button type="button" disabled={busy} onClick={() => void rotate(d.id)} className="rounded border border-amber-400/40 px-2 py-1 text-[11px]">Issue / rotate credential</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {detail && selected ? (
        <DeviceDetail detail={detail} deviceId={selected} tab={tab} />
      ) : null}
    </main>
  )
}

function DeviceDetail({ detail, deviceId, tab }: { detail: Record<string, unknown>; deviceId: string; tab: Tab }) {
  const device = detail.device as Record<string, unknown> | undefined
  const bridge = detail.bridge as Record<string, unknown> | undefined
  const coverage = detail.coverage as { mapped?: number; unmapped?: number } | undefined
  const errors = (detail.recentErrors as Array<{ id: string; parse_error?: string; received_at?: string }>) ?? []
  const [messages, setMessages] = useState<Array<{ id: string; protocol: string; parse_status: string; payload_hash: string; received_at: string }>>([])

  useEffect(() => {
    if (tab !== "messages") return
    fetch(`/api/lab/instruments/${deviceId}/messages`, { cache: "no-store" })
      .then(async (res) => res.json())
      .then((data) => setMessages(data.messages ?? []))
      .catch(() => setMessages([]))
  }, [deviceId, tab])

  return (
    <section className="mt-8 rounded-2xl border border-subtle bg-surface p-5">
      <h2 className="font-medium">{String(device?.name ?? "Device")}</h2>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div><dt className="text-xs text-muted-color">Protocol</dt><dd>{String(device?.protocol ?? "—")}</dd></div>
        <div><dt className="text-xs text-muted-color">Validation</dt><dd>{String(device?.validation_status ?? "—")}</dd></div>
        <div><dt className="text-xs text-muted-color">Heartbeat</dt><dd>{bridge?.heartbeat_at ? new Date(String(bridge.heartbeat_at)).toLocaleString() : "never"}</dd></div>
        <div><dt className="text-xs text-muted-color">Queue</dt><dd>{JSON.stringify(bridge?.queue_summary ?? {})}</dd></div>
        <div><dt className="text-xs text-muted-color">Coverage</dt><dd>Mapped {coverage?.mapped ?? 0} · Unmapped {coverage?.unmapped ?? 0}</dd></div>
        <div><dt className="text-xs text-muted-color">Credential prefix</dt><dd>{String(bridge?.api_key_prefix ?? "not issued")}</dd></div>
      </dl>
      {tab === "messages" ? (
        <ul className="mt-4 space-y-2 text-xs">
          {messages.map((row) => (
            <li key={row.id} className="rounded border border-subtle px-3 py-2">
              {row.received_at} · {row.protocol} · {row.parse_status} · {row.payload_hash.slice(0, 12)}
            </li>
          ))}
          {messages.length === 0 ? <li className="text-muted-color">No raw messages yet.</li> : null}
        </ul>
      ) : null}
      {errors.length ? (
        <div className="mt-4">
          <h3 className="text-xs uppercase text-muted-color">Recent parser errors</h3>
          <ul className="mt-2 space-y-1 text-xs text-amber-200">
            {errors.map((row) => <li key={row.id}>{row.received_at} · {row.parse_error}</li>)}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
