import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const dir = __dirname
const up = readFileSync(join(dir, 'up.sql'), 'utf8').toLowerCase()
const down = readFileSync(join(dir, 'down.sql'), 'utf8').toLowerCase()
const tables = ['pharmacy_audit_logs', 'audit_log', 'audit_events']

describe('proposed audit tenant FK migration (not applied)', () => {
  it('only swaps tenant FKs to RESTRICT and never touches row data', () => {
    for (const t of tables) {
      expect(up).toContain(`alter table public.${t}`)
      expect(up).toMatch(new RegExp(`${t}_tenant_id_fkey[\\s\\S]*?on delete restrict not valid`))
      expect(up).toContain(`validate constraint ${t}_tenant_id_fkey`)
    }
    for (const forbidden of [/\bdelete\s+from\b/, /\bupdate\s+public\./, /\btruncate\b/, /\bdrop\s+table\b/, /\bauth\./]) {
      expect(up).not.toMatch(forbidden)
      expect(down).not.toMatch(forbidden)
    }
  })

  it('has a rollback that restores ON DELETE CASCADE for every table', () => {
    for (const t of tables) expect(down).toMatch(new RegExp(`${t}_tenant_id_fkey[\\s\\S]*?on delete cascade`))
  })

  it('is not inside supabase/migrations (cannot be auto-applied)', () => {
    expect(dir.replace(/\\/g, '/')).toContain('supabase/proposed/')
  })
})
