create table public.cavli_runtime_keys (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  can_seed boolean not null default false,
  expires_at timestamptz
);
alter table public.cavli_runtime_keys enable row level security;
revoke all on public.cavli_runtime_keys from public, anon, authenticated;
grant select on public.cavli_runtime_keys to service_role;
