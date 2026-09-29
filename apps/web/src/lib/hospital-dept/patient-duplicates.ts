export type DuplicateCandidate = {
  id: string
  mrn: string | null
  full_name: string
  dob: string | null
  sex: string | null
  phone: string | null
  nin: string | null
}

export type DuplicateProbe = {
  full_name: string
  dob?: string
  phone?: string
  nin?: string
}

const CANDIDATE_COLUMNS = 'id, mrn, full_name, dob, sex, phone, nin'
const MAX_CANDIDATES = 5

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`)
}

/**
 * Same NIN or phone is a match on its own. Same name is a match unless both
 * records carry a date of birth and the dates differ.
 */
export function isLikelyDuplicate(probe: DuplicateProbe, candidate: DuplicateCandidate): boolean {
  if (probe.nin && candidate.nin && probe.nin.trim() === candidate.nin.trim()) return true
  if (probe.phone && candidate.phone && probe.phone.trim() === candidate.phone.trim()) return true
  if (normalizeName(probe.full_name) !== normalizeName(candidate.full_name)) return false
  if (probe.dob && candidate.dob) return probe.dob.slice(0, 10) === candidate.dob.slice(0, 10)
  return true
}

export async function findDuplicatePatients(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  tenantId: string,
  probe: DuplicateProbe,
): Promise<DuplicateCandidate[]> {
  const base = () =>
    db.from('patients').select(CANDIDATE_COLUMNS).eq('tenant_id', tenantId).eq('is_deleted', false).limit(MAX_CANDIDATES)

  const lookups = [base().ilike('full_name', escapeLike(probe.full_name.trim().replace(/\s+/g, ' ')))]
  if (probe.phone?.trim()) lookups.push(base().eq('phone', probe.phone.trim()))
  if (probe.nin?.trim()) lookups.push(base().eq('nin', probe.nin.trim()))

  const results = await Promise.all(lookups)
  const byId = new Map<string, DuplicateCandidate>()
  for (const { data, error } of results) {
    if (error) throw new Error(error.message)
    for (const row of (data ?? []) as DuplicateCandidate[]) {
      if (isLikelyDuplicate(probe, row)) byId.set(row.id, row)
    }
  }
  return [...byId.values()].slice(0, MAX_CANDIDATES)
}
