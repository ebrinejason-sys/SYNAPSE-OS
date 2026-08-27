/**
 * SYNAPSE deployment modes. Hospitals should not have to throw away an EMR
 * to buy intelligence, coding, pathways, or exchange.
 */

export const DEPLOYMENT_MODES = [
  {
    id: "native",
    name: "Native",
    headline: "SYNAPSE runs the facility",
    summary:
      "Synapse OS, Lab, Pharm and App operate the care journey on Synapse Core identity, consent and audit.",
    examples: ["Synapse OS", "Synapse Lab", "Synapse Pharm", "Synapse App"],
  },
  {
    id: "overlay",
    name: "Overlay",
    headline: "Keep the EMR. Connect SYNAPSE.",
    summary:
      "SYNAPSE sits beside eAFYA, UgandaEMR, ClinicMaster, ALIS or another system and adds identity, intelligence, ICD-11, pathways, insurance and longitudinal records.",
    examples: ["eAFYA", "UgandaEMR", "ALIS", "ClinicMaster", "other EMRs"],
  },
  {
    id: "network",
    name: "Network",
    headline: "Coordinate many facilities",
    summary:
      "Synapse Exchange connects hospitals, labs, pharmacies and national systems through standards-based adapters — not a claim of a live national HIE.",
    examples: ["HIE / registries", "laboratories", "pharmacies", "national systems"],
  },
] as const

export type DeploymentModeId = (typeof DEPLOYMENT_MODES)[number]["id"]

export const POSITIONING = {
  promise: "Intelligence for the entire care journey.",
  differentiator:
    "SYNAPSE is the intelligence, clinical orchestration and interoperability layer that can either run a hospital itself or make the hospital's existing systems substantially smarter.",
  notAClaim:
    "Do not claim live eAFYA, ALIS, UgandaEMR or Ministry partnerships. Simulation adapters are labelled simulation.",
} as const
