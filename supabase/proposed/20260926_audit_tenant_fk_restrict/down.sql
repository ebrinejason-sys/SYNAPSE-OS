-- Rollback for up.sql: restore the previous ON DELETE CASCADE behaviour.
begin;

alter table public.pharmacy_audit_logs
  drop constraint if exists pharmacy_audit_logs_tenant_id_fkey,
  add constraint pharmacy_audit_logs_tenant_id_fkey
    foreign key (tenant_id) references public.tenants(id) on delete cascade;

alter table public.audit_log
  drop constraint if exists audit_log_tenant_id_fkey,
  add constraint audit_log_tenant_id_fkey
    foreign key (tenant_id) references public.tenants(id) on delete cascade;

alter table public.audit_events
  drop constraint if exists audit_events_tenant_id_fkey,
  add constraint audit_events_tenant_id_fkey
    foreign key (tenant_id) references public.tenants(id) on delete cascade;

commit;
