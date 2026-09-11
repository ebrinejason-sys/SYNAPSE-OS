-- Materialized from production supabase_migrations.schema_migrations
-- project qfqakzmjatszisuqjwon on 2026-09-11 (read-only dump).
-- Remote version: 20260810093707  name: pharmacy_pilot_authority_hardening
-- DO NOT edit to "fix" history; additive follow-ups belong in new migrations.

-- Recorded after MCP execute_sql application of 20260810120000_pharmacy_pilot_authority_hardening.sql
-- Objects: extended receive_pharmacy_stock, adjust_pharmacy_batch_stock, reverse_pharmacy_sale, grants, inventory summary view
select to_regprocedure('public.receive_pharmacy_stock(uuid,uuid,text,integer,date,numeric,uuid,text,numeric,uuid,uuid,uuid,text)') is not null as receive_ok,
       to_regprocedure('public.adjust_pharmacy_batch_stock(uuid,uuid,integer,text,uuid,uuid,text,date,numeric,text)') is not null as adjust_ok,
       to_regprocedure('public.reverse_pharmacy_sale(uuid,uuid,uuid,text,text)') is not null as reverse_ok;
