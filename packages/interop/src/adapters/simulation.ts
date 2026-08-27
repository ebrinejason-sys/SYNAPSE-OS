/**
 * Clearly labelled simulation adapters. Not production integrations.
 */

import type { CanonicalPerson } from "../canonical"
import type { AdapterResult } from "../adapter"
import {
  applyNetworkFault,
  defaultReconcile,
  type AdapterHealth,
  type AdapterIdentity,
  type NetworkFault,
  type SynapseAdapter,
} from "./sdk"

function emptyOk<T>(data: T): AdapterResult<T> {
  return { ok: true, data }
}

function person(id: string, display: string, system: string): CanonicalPerson {
  return {
    resourceType: "Person",
    id,
    identifiers: [{ system, value: `${system}-${id}`, type: system.toUpperCase() }],
    name: { given: [display.split(" ")[0] ?? display], text: display },
  }
}

class SimulationAdapter implements SynapseAdapter {
  constructor(
    private readonly identity: AdapterIdentity,
    private readonly caps: string[],
    private readonly seedPatients: CanonicalPerson[],
    private readonly fault: NetworkFault = "none",
  ) {}

  identify(): AdapterIdentity {
    return this.identity
  }

  capabilities(): string[] {
    return this.caps
  }

  health(): AdapterHealth {
    return {
      status: "simulation",
      lastSuccessAt: null,
      lastFailureAt: null,
      detail: "Simulation adapter. Not a live national integration.",
    }
  }

  async pullPatients(): Promise<AdapterResult<CanonicalPerson[]>> {
    return applyNetworkFault(emptyOk(this.seedPatients), this.fault)
  }

  async pullEncounters(): Promise<AdapterResult<{ resources: [] }>> {
    return applyNetworkFault(emptyOk({ resources: [] }), this.fault)
  }

  async pullResults(): Promise<AdapterResult<{ resources: [] }>> {
    return applyNetworkFault(emptyOk({ resources: [] }), this.fault)
  }

  async pushPatient(remote: CanonicalPerson): Promise<AdapterResult<{ remoteId: string }>> {
    return applyNetworkFault(emptyOk({ remoteId: `sim-${remote.id}` }), this.fault)
  }

  async pushOrder(): Promise<AdapterResult<{ remoteId: string }>> {
    return applyNetworkFault(emptyOk({ remoteId: "sim-order" }), this.fault)
  }

  async pushPrescription(): Promise<AdapterResult<{ remoteId: string }>> {
    return applyNetworkFault(emptyOk({ remoteId: "sim-rx" }), this.fault)
  }

  mapInbound(payload: unknown): AdapterResult<{ resources: CanonicalPerson[] }> {
    if (payload && typeof payload === "object" && "id" in payload) {
      const row = payload as { id: string; display?: string }
      return {
        ok: true,
        data: { resources: [person(row.id, row.display ?? row.id, this.identity.system)] },
      }
    }
    return { ok: false, code: "UNMAPPED", message: `${this.identity.id} inbound payload not recognised` }
  }

  mapOutbound(resource: unknown): AdapterResult<unknown> {
    return { ok: true, data: { simulation: true, resource } }
  }

  reconcile(local: CanonicalPerson, remote: CanonicalPerson) {
    return defaultReconcile(local, remote)
  }
}

export function createSimulationAdapter(
  kind: "eafya" | "ugandaemr" | "alis" | "labexpert" | "dhis2" | "insurer" | "openmrs",
  fault: NetworkFault = "none",
): SynapseAdapter {
  const catalog: Record<typeof kind, { name: string; system: string; caps: string[] }> = {
    eafya: { name: "Mock eAFYA", system: "eafya", caps: ["pullPatients", "pullEncounters"] },
    ugandaemr: { name: "Mock UgandaEMR", system: "ugandaemr", caps: ["pullPatients", "mapInbound"] },
    openmrs: { name: "Mock OpenMRS", system: "openmrs", caps: ["pullPatients", "mapInbound"] },
    alis: { name: "Mock ALIS", system: "alis", caps: ["pullResults", "pushOrder"] },
    labexpert: { name: "Mock LabExpert", system: "labexpert", caps: ["pullResults"] },
    dhis2: { name: "Mock DHIS2", system: "dhis2", caps: ["mapOutbound"] },
    insurer: { name: "Mock Insurer", system: "insurer", caps: ["mapOutbound"] },
  }
  const spec = catalog[kind]
  return new SimulationAdapter(
    {
      id: `sim-${kind}`,
      name: spec.name,
      system: spec.system,
      mode: kind === "dhis2" ? "network" : "overlay",
      simulation: true,
      version: "0.1.0",
      preference: "fhir",
    },
    spec.caps,
    [person("sim-1", "Demo Overlay Patient", spec.system)],
    fault,
  )
}

export function createSimulationAdapterSet(fault: NetworkFault = "none"): SynapseAdapter[] {
  return (["eafya", "ugandaemr", "alis", "labexpert", "dhis2", "insurer"] as const).map((kind) =>
    createSimulationAdapter(kind, fault),
  )
}
