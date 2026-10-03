import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../../../..')
const read = (p: string) => readFileSync(resolve(root, p), 'utf8')
const migration = read('supabase/migrations/20261003160000_profiles_privileged_columns_guard.sql')
const sqlOnly = migration.replace(/--.*$/gm, '')

describe('profiles privileged-column guard migration', () => {
  it('removes broad INSERT/UPDATE from API roles and grants only self-service columns', () => {
    expect(sqlOnly).toMatch(/revoke insert, update, truncate, trigger, references on table public\.profiles from anon, authenticated/)
    const allow = sqlOnly.match(/'full_name'[\s\S]*?'updated_at'/)?.[0] ?? ''
    for (const col of ['role', 'tenant_id', 'hospital_id', 'department_id', 'is_admin', 'platform_control_role', 'password_hash', 'email', 'verification_status', 'must_change_password', 'locked_until']) {
      expect(allow).not.toContain(`'${col}'`)
    }
    expect(sqlOnly).not.toMatch(/grant (all|insert|update) on (table )?public\.profiles to (anon|authenticated)/)
  })

  it('installs a guard trigger restricting anon/authenticated to the allow-list', () => {
    expect(sqlOnly).toMatch(/create trigger profiles_guard_privileged_columns\s+before insert or update on public\.profiles/)
    expect(sqlOnly).toMatch(/current_user not in \('anon', 'authenticated'\)/)
    expect(sqlOnly).toMatch(/to_jsonb\(new\) - self_service\) is distinct from \(to_jsonb\(old\) - self_service\)/)
    expect(sqlOnly).toMatch(/errcode = '42501'/)
  })

  it('signup triggers no longer read is_admin, role or department_id from user metadata', () => {
    const fns = sqlOnly.slice(sqlOnly.indexOf('create or replace function public.handle_new_user()'))
    expect(fns).not.toMatch(/raw_user_meta_data\s*->>\s*'(is_admin|role|department_id)'/)
    expect(fns).toMatch(/new\.email,\s*false/)
    expect(fns).toMatch(/'patient'/)
  })

  it('keeps payroll compensation service-role only', () => {
    expect(sqlOnly).toMatch(/alter table public\.staff_compensation enable row level security/)
    expect(sqlOnly).toMatch(/revoke all on table public\.staff_compensation from public, anon, authenticated/)
  })
})

describe('admin pages do not write profiles from the browser', () => {
  for (const page of ['apps/web/src/app/admin/staff/invite/page.tsx', 'apps/web/src/app/admin/hr/payroll/page.tsx']) {
    it(page, () => {
      const src = read(page)
      expect(src).not.toMatch(/supabase\/client|createClient|auth\.signUp/)
      expect(src).not.toMatch(/from\(['"]profiles['"]\)/)
      expect(src).toMatch(/\/api\/hospital\/admin\//)
    })
  }
})
