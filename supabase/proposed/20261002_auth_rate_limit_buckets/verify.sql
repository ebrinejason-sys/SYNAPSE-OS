select to_regclass('public.auth_rate_limit_buckets') is not null as table_exists;
select relrowsecurity from pg_class where oid = 'public.auth_rate_limit_buckets'::regclass;
select has_function_privilege('anon', 'public.consume_auth_rate_limit(text,integer,integer)', 'execute') as anon_exec,
       has_function_privilege('authenticated', 'public.consume_auth_rate_limit(text,integer,integer)', 'execute') as auth_exec;
select count(*) filter (where bucket_key !~ '^[0-9a-f]{64}$') as non_hmac_keys from public.auth_rate_limit_buckets;
