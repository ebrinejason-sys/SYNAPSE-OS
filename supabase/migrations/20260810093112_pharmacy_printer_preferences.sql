-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260810093112  name: pharmacy_printer_preferences
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

alter table if exists public.pharmacy_settings
  add column if not exists receipt_paper_width text not null default '80',
  add column if not exists receipt_font_scale numeric not null default 1,
  add column if not exists auto_print_receipt boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pharmacy_settings_receipt_paper_width_check'
  ) then
    alter table public.pharmacy_settings
      add constraint pharmacy_settings_receipt_paper_width_check
      check (receipt_paper_width in ('58', '80', 'a4'));
  end if;
exception when undefined_table then
  null;
end $$;
