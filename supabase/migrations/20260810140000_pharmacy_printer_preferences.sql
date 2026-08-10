-- Additive printer preference columns for pharmacy admin receipt setup.
-- Safe if columns already exist.

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

comment on column public.pharmacy_settings.receipt_paper_width is
  'Thermal/A4 paper width used when rendering receipts: 58 | 80 | a4';
comment on column public.pharmacy_settings.receipt_font_scale is
  'Relative receipt font scale (1 = default)';
comment on column public.pharmacy_settings.auto_print_receipt is
  'When true, POS prompts print immediately after a successful sale';
