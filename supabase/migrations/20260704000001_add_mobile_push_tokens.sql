-- Mobile push notification token registry.
-- One row per (user, device); re-registering the same device updates the token in place.
create table if not exists public.mobile_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete set null,
  device_id text not null,
  token text not null,
  role text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, device_id)
);

create index if not exists mobile_push_tokens_user_id_idx on public.mobile_push_tokens(user_id);
create index if not exists mobile_push_tokens_tenant_id_idx on public.mobile_push_tokens(tenant_id);

alter table public.mobile_push_tokens enable row level security;
-- No public policies: this table is only read/written by server-side routes
-- using the service-role client (supabaseAdmin), which bypasses RLS.
