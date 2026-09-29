/**
 * Minimal filter-aware Supabase query mock for authorization tests.
 * Reads honour .eq/.neq/.in filters against seeded rows; writes are recorded
 * together with the filters that were applied, so tests can assert that every
 * mutation carries a tenant predicate and that out-of-scope ids write nothing.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export type MockWrite = { table: string; op: string; values: any; filters: Record<string, unknown> }

export function createTenantDbMock() {
  const state = {
    tables: {} as Record<string, Array<Record<string, unknown>>>,
    writes: [] as MockWrite[],
  }

  function from(table: string) {
    const eqs: Record<string, unknown> = {}
    const neqs: Record<string, unknown> = {}
    const ins: Record<string, unknown[]> = {}
    let write: { op: string; values: any } | null = null
    const match = () =>
      (state.tables[table] ?? []).filter(
        (r) =>
          Object.entries(eqs).every(([k, v]) => r[k] === v) &&
          Object.entries(neqs).every(([k, v]) => r[k] !== v) &&
          Object.entries(ins).every(([k, v]) => v.includes(r[k])),
      )
    const record = () => {
      if (!write) return
      state.writes.push({ table, op: write.op, values: write.values, filters: { ...eqs } })
    }
    const writeResult = () => {
      const v = Array.isArray(write!.values) ? write!.values[0] : write!.values
      return { id: 'new-id', ...(v ?? {}) }
    }
    const q: any = {
      then: (res: any, rej: any) => {
        record()
        const data = write ? (write.op === 'insert' ? [writeResult()] : null) : match()
        return Promise.resolve({ data, error: null, count: Array.isArray(data) ? data.length : 0 }).then(res, rej)
      },
    }
    for (const m of ['select', 'order', 'limit', 'lt', 'lte', 'gt', 'gte', 'ilike', 'or', 'is', 'not', 'range']) {
      q[m] = () => q
    }
    q.eq = (k: string, v: unknown) => ((eqs[k] = v), q)
    q.neq = (k: string, v: unknown) => ((neqs[k] = v), q)
    q.in = (k: string, v: unknown[]) => ((ins[k] = v), q)
    for (const op of ['update', 'insert', 'delete', 'upsert']) {
      q[op] = (values?: unknown) => ((write = { op, values }), q)
    }
    const one = async () => {
      if (write) {
        record()
        if (write.op === 'insert' || write.op === 'upsert') return { data: writeResult(), error: null }
        const hit = match()[0]
        return { data: hit ? { ...hit, ...(write.values ?? {}) } : null, error: hit ? null : { message: 'no rows' } }
      }
      return { data: match()[0] ?? null, error: null }
    }
    q.maybeSingle = one
    q.single = one
    return q
  }

  return {
    state,
    client: {
      from,
      rpc: async () => ({ data: null, error: null }),
      auth: { admin: { listUsers: async () => ({ data: { users: [] }, error: null }) } },
    },
  }
}
