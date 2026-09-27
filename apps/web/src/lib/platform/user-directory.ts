/**
 * Server-side platform user directory query.
 *
 * Search, role and status filters are applied in the database query and the
 * result is paginated with an exact total, so an account is findable no matter
 * how many profiles exist. (The previous page loaded a fixed first 200 rows and
 * filtered them in memory, which hid older accounts, including archived ones.)
 *
 * Callers must enforce RBAC first (`user.read`); this module only builds the query.
 */

export const USER_DIRECTORY_COLUMNS =
  "id, full_name, email, role, verification_status, email_verified_at, synapse_id, is_deleted, created_at, last_sign_in_at"

export const USER_STATUS_FILTERS = ["active", "suspended", "archived", "pending"] as const
export type UserStatusFilter = (typeof USER_STATUS_FILTERS)[number]

/** verification_status values that the auth layer treats as suspended (see @synapse/auth activation). */
export const SUSPENDED_VERIFICATION_STATUSES = ["suspended", "disabled", "reset"] as const
/** verification_status values that the auth layer treats as archived, in addition to is_deleted. */
export const ARCHIVED_VERIFICATION_STATUSES = ["deleted"] as const

export const DEFAULT_PAGE_SIZE = 50
export const MAX_PAGE_SIZE = 100
const MAX_QUERY_LENGTH = 100
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type UserDirectoryRow = {
  id?: string
  full_name?: string | null
  email?: string | null
  role?: string | null
  verification_status?: string | null
  email_verified_at?: string | null
  synapse_id?: string | null
  is_deleted?: boolean | null
  created_at?: string | null
  last_sign_in_at?: string | null
}

export type UserDirectoryParams = {
  q?: string | null
  role?: string | null
  status?: string | null
  page?: string | number | null
  pageSize?: string | number | null
}

export type NormalizedDirectoryParams = {
  q: string
  role: string
  status: UserStatusFilter | ""
  page: number
  pageSize: number
}

export type UserDirectoryResult = {
  rows: UserDirectoryRow[]
  total: number
  page: number
  pageSize: number
  pageCount: number
  error: string | null
  params: NormalizedDirectoryParams
}

/**
 * Strip characters that carry meaning in PostgREST filter syntax (`,` `(` `)`
 * separate `or()` terms, `*`/`%` are wildcards, `\\` escapes, `:` and `"` quote)
 * so user input can only ever be a literal substring.
 */
export function sanitizeSearchTerm(raw: unknown): string {
  return String(raw ?? "")
    .replace(/[,()*%\\:"'`]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_QUERY_LENGTH)
}

function toInt(value: unknown, fallback: number) {
  const n = Number.parseInt(String(value ?? ""), 10)
  return Number.isFinite(n) ? n : fallback
}

export function normalizeDirectoryParams(params: UserDirectoryParams = {}): NormalizedDirectoryParams {
  const status = String(params.status ?? "").trim().toLowerCase()
  const role = String(params.role ?? "").trim().toLowerCase()
  return {
    q: sanitizeSearchTerm(params.q),
    role: /^[a-z0-9_]{1,64}$/.test(role) ? role : "",
    status: (USER_STATUS_FILTERS as readonly string[]).includes(status) ? (status as UserStatusFilter) : "",
    page: Math.max(1, toInt(params.page, 1)),
    pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, toInt(params.pageSize, DEFAULT_PAGE_SIZE))),
  }
}

const inList = (values: readonly string[]) => `(${values.join(",")})`

// Minimal structural type for the PostgREST builder methods used here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Query = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from(table: string): any }

export function applyDirectoryFilters(query: Query, p: NormalizedDirectoryParams): Query {
  // is_deleted is nullable in production; "not archived" is therefore `is_deleted IS NOT TRUE`.
  let q = query
  if (p.q) {
    const like = `%${p.q}%`
    const terms = [`email.ilike.${like}`, `full_name.ilike.${like}`, `synapse_id.ilike.${like}`]
    if (UUID_RE.test(p.q)) terms.push(`id.eq.${p.q.toLowerCase()}`)
    q = q.or(terms.join(","))
  }
  if (p.role) q = q.eq("role", p.role)

  switch (p.status) {
    case "archived":
      q = q.or(`is_deleted.eq.true,verification_status.in.${inList(ARCHIVED_VERIFICATION_STATUSES)}`)
      break
    case "suspended":
      q = q.not("is_deleted", "is", true).in("verification_status", [...SUSPENDED_VERIFICATION_STATUSES])
      break
    case "pending":
      // Invited / not yet activated (email never verified), and not archived.
      q = q.not("is_deleted", "is", true).is("email_verified_at", null)
      break
    case "active":
      q = q
        .not("is_deleted", "is", true)
        .not("email_verified_at", "is", null)
        .or(
          `verification_status.is.null,verification_status.not.in.${inList([
            ...SUSPENDED_VERIFICATION_STATUSES,
            ...ARCHIVED_VERIFICATION_STATUSES,
          ])}`,
        )
      break
    default:
      break
  }
  return q
}

export async function searchPlatformUsers(db: Db, params: UserDirectoryParams = {}): Promise<UserDirectoryResult> {
  const p = normalizeDirectoryParams(params)
  const from = (p.page - 1) * p.pageSize
  const to = from + p.pageSize - 1
  let query = db.from("profiles").select(USER_DIRECTORY_COLUMNS, { count: "exact" })
  query = applyDirectoryFilters(query, p)
  query = query.order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to)

  try {
    const { data, count, error } = await query
    if (error) {
      return { rows: [], total: 0, page: p.page, pageSize: p.pageSize, pageCount: 0, error: String(error.message ?? "Query failed"), params: p }
    }
    const total = typeof count === "number" ? count : (data ?? []).length
    return {
      rows: (data ?? []) as UserDirectoryRow[],
      total,
      page: p.page,
      pageSize: p.pageSize,
      pageCount: Math.max(1, Math.ceil(total / p.pageSize)),
      error: null,
      params: p,
    }
  } catch (err) {
    return { rows: [], total: 0, page: p.page, pageSize: p.pageSize, pageCount: 0, error: err instanceof Error ? err.message : "Query failed", params: p }
  }
}

/** Build a users-page href that keeps the active filters. */
export function directoryHref(p: NormalizedDirectoryParams, overrides: Partial<NormalizedDirectoryParams> = {}) {
  const next = { ...p, ...overrides }
  const qs = new URLSearchParams()
  if (next.q) qs.set("q", next.q)
  if (next.role) qs.set("role", next.role)
  if (next.status) qs.set("status", next.status)
  if (next.page > 1) qs.set("page", String(next.page))
  if (next.pageSize !== DEFAULT_PAGE_SIZE) qs.set("pageSize", String(next.pageSize))
  const s = qs.toString()
  return s ? `/platform/users?${s}` : "/platform/users"
}
