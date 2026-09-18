import {
  getEncounters,
  getTriage,
  getOrders,
  getLabResults,
  getPrescriptions,
  getDispenses,
  getPayments,
  getPersons,
} from "./browser-repository"

export type JourneyStepId = "reception" | "nurse" | "doctor" | "lab" | "review" | "pharmacist" | "billing" | "timeline"

export type JourneyProgress = {
  complete: Record<JourneyStepId, boolean>
  current: JourneyStepId
  patientName: string
  patientAge: string
  patientSex: string
  visitLabel: string
}

function ageFromDob(dob?: string) {
  if (!dob) return "—"
  const years = new Date().getFullYear() - new Date(dob).getFullYear()
  return Number.isFinite(years) ? `${years}y` : "—"
}

export async function loadJourneyProgress(): Promise<JourneyProgress> {
  const [encounters, orders, results, prescriptions, dispenses, payments, persons] = await Promise.all([
    getEncounters(),
    getOrders(),
    getLabResults(),
    getPrescriptions(),
    getDispenses(),
    getPayments(),
    getPersons(),
  ])
  const encounter = [...encounters].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  const triage = encounter ? await getTriage(encounter.id) : null
  const person = persons.find((row) => row.id === encounter?.personId) ?? persons[0]
  const released = results.some((row) => row.status === "released" || row.status === "verified")
  const complete: Record<JourneyStepId, boolean> = {
    reception: Boolean(encounter),
    nurse: Boolean(triage),
    doctor: orders.length > 0,
    lab: released || results.some((row) => row.status === "released"),
    review: released,
    pharmacist: dispenses.length > 0,
    billing: payments.length > 0 || encounter?.status === "completed",
    timeline: payments.length > 0 || encounter?.status === "completed",
  }
  const order: JourneyStepId[] = ["reception", "nurse", "doctor", "lab", "review", "pharmacist", "billing", "timeline"]
  const current = order.find((step) => !complete[step]) ?? "timeline"
  return {
    complete,
    current,
    patientName: person?.name ?? "Amina Demo",
    patientAge: ageFromDob(person?.dateOfBirth),
    patientSex: person?.sex === "female" ? "Female" : person?.sex === "male" ? "Male" : "Unknown",
    visitLabel: encounter ? encounter.encounterType.toUpperCase() : "No visit yet",
  }
}
