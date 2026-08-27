import {
  CAPABILITY_GATES,
  comparisonCell,
  type ComparisonCell,
} from "./capability-gates"

export type ComparisonRow = {
  id: string
  feature: string
  requirement: string
  synapse: ComparisonCell
  openmrs: ComparisonCell
  slade: ComparisonCell
  paper: ComparisonCell
}

/**
 * Public comparison table. Synapse cells are derived from capability gates.
 * Competitor cells are editorial and must not be used to inflate Synapse.
 */
const COMPETITOR_CELLS: Record<
  string,
  { openmrs: ComparisonCell; slade: ComparisonCell; paper: ComparisonCell }
> = {
  "ai-differential": { openmrs: "no", slade: "no", paper: "no" },
  "offline-first": { openmrs: "partial", slade: "no", paper: "yes" },
  "fhir-r4": { openmrs: "yes", slade: "partial", paper: "no" },
  "insurance-copilot": { openmrs: "no", slade: "partial", paper: "no" },
  "icd-11": { openmrs: "partial", slade: "partial", paper: "no" },
  "uganda-guidelines": { openmrs: "no", slade: "yes", paper: "no" },
  "mobile-app": { openmrs: "no", slade: "no", paper: "no" },
  "pharmacy-pos": { openmrs: "no", slade: "yes", paper: "no" },
  dhis2: { openmrs: "no", slade: "no", paper: "no" },
  "longitudinal-timeline": { openmrs: "partial", slade: "partial", paper: "no" },
  "clinical-pathway-engine": { openmrs: "no", slade: "no", paper: "no" },
  "explainable-reasoning": { openmrs: "no", slade: "no", paper: "no" },
  "claim-rejection-prevention": { openmrs: "no", slade: "partial", paper: "no" },
  "synthetic-simulation": { openmrs: "no", slade: "no", paper: "no" },
  "cross-system-identity": { openmrs: "partial", slade: "no", paper: "no" },
  "facility-observability": { openmrs: "no", slade: "no", paper: "no" },
}

export const COMPARISON_MATRIX: ComparisonRow[] = CAPABILITY_GATES.map((gate) => {
  const competitors = COMPETITOR_CELLS[gate.id] ?? {
    openmrs: "no" as const,
    slade: "no" as const,
    paper: "no" as const,
  }
  return {
    id: gate.id,
    feature: gate.comparisonLabel,
    requirement: gate.requirement,
    synapse: comparisonCell(gate),
    ...competitors,
  }
})
