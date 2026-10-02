-- Read-only checks after applying 20261002150000 (expect 0 / true).
select count(*) as plaintext_rows from public.facility_invitations where invite_token is not null;
select count(*) as rows_without_hash from public.facility_invitations where token_hash is null;
select exists(select 1 from pg_constraint where conname='facility_invitations_no_plaintext_token' and convalidated) as no_plaintext_constraint;
select count(*) - count(distinct token_hash) as duplicate_hashes from public.facility_invitations;
