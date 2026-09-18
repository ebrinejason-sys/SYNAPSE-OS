import { demoHref } from "./paths"
import type { DemoRole } from "./entities"

export const DEMO_THEME_STORAGE_KEY = "synapse-demo-theme"
export const DEMO_TIP_STORAGE_KEY = "synapse-demo-tip-dismissed"

export type DemoStationId =
  | "reception"
  | "nurse"
  | "doctor"
  | "lab"
  | "review"
  | "pharmacist"
  | "billing"
  | "timeline"

export type DemoStation = {
  id: DemoStationId
  label: string
  leaf: "reception" | "nurse" | "doctor" | "lab" | "pharmacist" | "billing" | "timeline"
  role: DemoRole | null
  facilityId: string | null
  hrefSuffix?: string
  progressKey: "reception" | "nurse" | "doctor" | "lab" | "review" | "pharmacist" | "billing" | "timeline"
}

export const DEMO_STATIONS: DemoStation[] = [
  { id: "reception", label: "Reception", leaf: "reception", role: "reception", facilityId: "demo-hospital", progressKey: "reception" },
  { id: "nurse", label: "Nurse", leaf: "nurse", role: "nurse", facilityId: "demo-hospital", progressKey: "nurse" },
  { id: "doctor", label: "Doctor", leaf: "doctor", role: "doctor", facilityId: "demo-hospital", progressKey: "doctor" },
  { id: "lab", label: "Lab", leaf: "lab", role: "lab_technician", facilityId: "demo-lab", progressKey: "lab" },
  { id: "review", label: "Doctor Review", leaf: "doctor", role: "doctor", facilityId: "demo-hospital", hrefSuffix: "?stage=review", progressKey: "review" },
  { id: "pharmacist", label: "Pharmacy", leaf: "pharmacist", role: "pharmacist", facilityId: "demo-pharmacy", progressKey: "pharmacist" },
  { id: "billing", label: "Billing", leaf: "billing", role: "cashier", facilityId: "demo-hospital", progressKey: "billing" },
  { id: "timeline", label: "Timeline", leaf: "timeline", role: null, facilityId: null, progressKey: "timeline" },
]

export function stationHref(stationId: DemoStationId) {
  const station = DEMO_STATIONS.find((row) => row.id === stationId)
  if (!station) return demoHref("reception")
  return `${demoHref(station.leaf)}${station.hrefSuffix ?? ""}`
}

export function applyStationSession(stationId: DemoStationId) {
  const station = DEMO_STATIONS.find((row) => row.id === stationId)
  if (!station || typeof window === "undefined") return
  const current = sessionStorage.getItem("synapse_demo_role")
  if (station.id === "lab") {
    if (current !== "lab_scientist") sessionStorage.setItem("synapse_demo_role", "lab_technician")
  } else if (station.role) {
    sessionStorage.setItem("synapse_demo_role", station.role)
  }
  if (station.facilityId) sessionStorage.setItem("synapse_demo_facility", station.facilityId)
  sessionStorage.setItem("synapse_demo_mode", "true")
}

export function enterLabScientist() {
  if (typeof window === "undefined") return
  sessionStorage.setItem("synapse_demo_role", "lab_scientist")
  sessionStorage.setItem("synapse_demo_facility", "demo-lab")
  sessionStorage.setItem("synapse_demo_mode", "true")
  window.location.assign(demoHref("lab"))
}

export function enterStation(stationId: DemoStationId) {
  const station = DEMO_STATIONS.find((row) => row.id === stationId)
  if (!station) return
  applyStationSession(stationId)
  window.location.href = stationHref(stationId)
}

export function readDemoRole(): DemoRole {
  if (typeof window === "undefined") return "reception"
  const raw = sessionStorage.getItem("synapse_demo_role") || "reception"
  if (raw === "lab") return "lab_technician"
  return raw as DemoRole
}

export function stationFromPath(pathname: string, search = ""): DemoStation {
  if (search.includes("stage=review") || pathname.includes("stage=review")) {
    return DEMO_STATIONS.find((row) => row.id === "review") ?? DEMO_STATIONS[2]!
  }
  const match = DEMO_STATIONS.find((row) => {
    if (row.id === "review") return false
    return pathname === `/demo/${row.leaf}` || pathname.endsWith(`/${row.leaf}`)
  })
  return match ?? DEMO_STATIONS[0]!
}

export const DEMO_THEME_FOUC = `(function(){try{var d=document.documentElement,k='${DEMO_THEME_STORAGE_KEY}',t=localStorage.getItem(k);if(!t){t='light';}if(t==='system'){t=window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light';}if(t==='dark'||t==='light'){d.setAttribute('data-theme',t);localStorage.setItem('synapse-theme',t);}}catch(e){}})();`
