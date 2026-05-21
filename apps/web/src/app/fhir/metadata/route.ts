import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    resourceType: "CapabilityStatement",
    status: "active",
    date: new Date().toISOString(),
    publisher: "Synapse Health Technologies Ltd",
    kind: "instance",
    software: { name: "Synapse OS", version: "9.0" },
    fhirVersion: "4.0.1",
    format: ["json"],
    rest: [{ mode: "server", resource: [
      { type: "Patient" },
      { type: "Observation" },
      { type: "Condition" },
      { type: "MedicationRequest" },
      { type: "DiagnosticReport" },
      { type: "Immunization" },
      { type: "Encounter" },
      { type: "AllergyIntolerance" },
    ]}],
  });
}
