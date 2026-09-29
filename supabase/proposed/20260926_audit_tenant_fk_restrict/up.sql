-- PROPOSED — NOT APPLIED. Requires an explicit DB-apply decision (see README.md).
-- Stop tenant hard-deletes from silently erasing audit history.
-- Audit rows currently reference tenants ON DELETE CASCADE; switch to RESTRICT so a
-- tenant that has audit history cannot be hard-deleted (archive it instead).
-- NOT VALID + VALIDATE keeps the lock short; existing rows already satisfy the FK.

begin;

alter table public.pharmacy_audit_logs
  drop constraint if exists pharmacy_audit_logs_tenant_id_fkey,
  add constraint pharmacy_audit_logs_tenant_id_fkey
    foreign key (tenant_id) references public.tenants(id) on delete restrict not valid;
alter table public.pharmacy_audit_logs validate constraint pharmacy_audit_logs_tenant_id_fkey;

alter table public.audit_log
  drop constraint if exists audit_log_tenant_id_fkey,
  add constraint audit_log_tenant_id_fkey
    foreign key (tenant_id) references public.tenants(id) on delete restrict not valid;
alter table public.audit_log validate constraint audit_log_tenant_id_fkey;

alter table public.audit_events
  drop constraint if exists audit_events_tenant_id_fkey,
  add constraint audit_events_tenant_id_fkey
    foreign key (tenant_id) references public.tenants(id) on delete restrict not valid;
alter table public.audit_events validate constraint audit_events_tenant_id_fkey;

commit;
