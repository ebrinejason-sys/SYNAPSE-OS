/**
 * Fail closed on malformed identifiers.
 * Never coerce JS `undefined` / the string "undefined" into a UUID column —
 * Postgres 22P02 is a symptom of that leak, not a test to skip.
 */

import { isUuid } from "./sync-contract.ts"

export class InvalidIdentifierError extends Error {
  readonly field: string
  readonly code = "INVALID_IDENTIFIER" as const

  constructor(field: string) {
    super(`INVALID_IDENTIFIER:${field}`)
    this.name = "InvalidIdentifierError"
    this.field = field
  }
}

function isAbsent(value: unknown): boolean {
  return value == null || value === ""
}

function isMalformedToken(value: unknown): boolean {
  return value === "undefined" || value === "null" || value === "NaN"
}

export function requireUuid(value: unknown, field: string): string {
  if (isAbsent(value) || isMalformedToken(value) || typeof value !== "string" || !isUuid(value)) {
    throw new InvalidIdentifierError(field)
  }
  return value
}

export function optionalUuid(value: unknown, field: string): string | null {
  if (isAbsent(value)) return null
  return requireUuid(value, field)
}

export function requireTenantId(value: unknown): string {
  return requireUuid(value, "tenant_id")
}
