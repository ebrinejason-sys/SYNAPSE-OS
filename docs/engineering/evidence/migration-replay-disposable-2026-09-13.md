# Migration replay on disposable Postgres

- Image: `public.ecr.aws/supabase/postgres:17.6.1.104`
- Container: `synapse-mig-replay-1552091`
- Port: `32771`
- Started: 2026-09-13T08:19:01Z
- SHA: 20aa914
- Note: does not touch synapse-rc1-lab / production

## Failures (in apply order)

- `20260410211144_dduka_dash_schema_v2.sql`: psql:<stdin>:7: ERROR:  relation "public.profiles" does not exist 
- `20260410211427_seed_data.sql`: psql:<stdin>:13: ERROR:  relation "public.products" does not exist 
- `20260503150842_extend_profiles_role_enum_superadmin.sql`: psql:<stdin>:8: ERROR:  relation "public.profiles" does not exist 
- `20260503175422_create_demo_schema.sql`: psql:<stdin>:110: ERROR:  function auth.uid() does not exist 
- `20260503191458_create_demo_auth_user.sql`: psql:<stdin>:61: ERROR:  column "email_confirmed_at" of relation "users" does not exist 
- `20260504045522_fix_demo_rls_use_jwt_email.sql`: psql:<stdin>:17: ERROR:  function auth.jwt() does not exist 
- `20260604163130_add_tenant_performance_indexes.sql`: psql:<stdin>:6: ERROR:  relation "encounters" does not exist 
- `20260604163142_add_missing_platform_tables.sql`: psql:<stdin>:15: ERROR:  relation "hospitals" does not exist 
- `20260605150957_add_synapse_id_core_tables.sql`: psql:<stdin>:30: ERROR:  relation "hospitals" does not exist 
- `20260605193131_fix_rls_8_exposed_tables.sql`: psql:<stdin>:13: ERROR:  relation "public.patient_profiles" does not exist 
- `20260605193214_add_tenant_id_indexes_batch.sql`: psql:<stdin>:13: ERROR:  relation "public.encounter_orders" does not exist 
- `20260605193303_seed_demo_labs_and_modules.sql`: psql:<stdin>:90: ERROR:  relation "hospitals" does not exist 
- `20260605194256_enable_rls_on_8_exposed_tables.sql`: psql:<stdin>:12: ERROR:  relation "public.patient_profiles" does not exist 
- `20260605194359_add_tenant_id_indexes_all_70_tables.sql`: psql:<stdin>:12: ERROR:  relation "public.aefi_reports" does not exist 
- `20260605194536_seed_demo_lab_results_and_upsert_modules.sql`: psql:<stdin>:62: ERROR:  relation "hospital_modules" does not exist 

Stopped after 15 failures (remaining migrations not attempted).

## Summary

- Applied cleanly before stop: **4** / 164 attempted until stop
- Distinct failures recorded: **15**
- Finished: 2026-09-13T08:19:04Z

Container left running for inspection: `synapse-mig-replay-1552091` on 127.0.0.1:32771 (label synapse.disposable-test=true).

