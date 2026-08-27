import { NextRequest, NextResponse } from "next/server"
import {
  UNIMPLEMENTED_FHIR_RESOURCES,
  isFlagshipFhirResource,
  searchBundle,
} from "@synapse/interop"
import { getCurrentUser } from "@/lib/auth/getCurrentUser"

function operationOutcome(diagnostics: string, status: number, code = "processing") {
  return NextResponse.json(
    {
      resourceType: "OperationOutcome",
      issue: [{ severity: status >= 500 ? "error" : "information", code, diagnostics }],
    },
    { status },
  )
}

export async function requireFhirTenant() {
  const user = await getCurrentUser()
  if (!user) return { error: operationOutcome("Authentication required", 401, "login") }
  if (!user.tenantId) return { error: operationOutcome("Tenant context required", 403, "forbidden") }
  return { user }
}

export function classifyFhirType(resource: string): "flagship" | "unimplemented" | "unknown" {
  if ((UNIMPLEMENTED_FHIR_RESOURCES as readonly string[]).includes(resource)) return "unimplemented"
  if (isFlagshipFhirResource(resource)) return "flagship"
  return "unknown"
}

export async function handleFhirSearch(req: NextRequest, resource: string) {
  const classified = classifyFhirType(resource)
  if (classified === "unimplemented") {
    return operationOutcome(
      `${resource} is not in the SYNAPSE flagship FHIR set and remains unimplemented.`,
      501,
      "not-supported",
    )
  }
  if (classified === "unknown") {
    return operationOutcome(`Unsupported FHIR resource type ${resource}`, 404, "not-found")
  }
  const auth = await requireFhirTenant()
  if ("error" in auth && auth.error) return auth.error
  void req
  void resource
  return NextResponse.json(searchBundle([]))
}

export async function handleFhirRead(_req: NextRequest, resource: string, id: string) {
  const classified = classifyFhirType(resource)
  if (classified === "unimplemented") {
    return operationOutcome(
      `${resource} is not in the SYNAPSE flagship FHIR set and remains unimplemented.`,
      501,
      "not-supported",
    )
  }
  if (classified === "unknown") {
    return operationOutcome(`Unsupported FHIR resource type ${resource}`, 404, "not-found")
  }
  const auth = await requireFhirTenant()
  if ("error" in auth && auth.error) return auth.error
  if (!id) return operationOutcome("Resource id required", 400, "required")
  return operationOutcome(`${resource}/${id} was not found in tenant ${auth.user?.tenantId}`, 404, "not-found")
}
