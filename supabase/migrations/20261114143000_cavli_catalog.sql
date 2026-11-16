create extension if not exists vector with schema extensions;

create table public.product_modules (
  id text primary key,
  technology text not null,
  peak_downlink_mbps numeric not null check (peak_downlink_mbps > 0),
  peak_uplink_mbps numeric not null check (peak_uplink_mbps > 0),
  source_url text not null,
  evidence_id text not null
);

create table public.product_evidence (
  id text primary key,
  module_id text not null references public.product_modules(id),
  section text not null,
  body text not null,
  tags text[] not null,
  source_url text not null,
  embedding extensions.vector(384),
  embedding_model text check (embedding_model = 'gte-small'),
  check ((embedding is null) = (embedding_model is null))
);

create table public.chat_feedback (
  answer_id uuid primary key,
  rating text not null check (rating in ('helpful','needs_review')),
  reason text check (reason in ('incorrect_spec','wrong_variant','weak_citation','other')),
  status text not null check (status in ('answered','recommendation','unsupported','clarify')),
  evidence_ids text[] not null,
  reviewed boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.product_modules enable row level security;
alter table public.product_evidence enable row level security;
alter table public.chat_feedback enable row level security;
revoke all on public.product_modules, public.product_evidence, public.chat_feedback from public, anon, authenticated;
grant select on public.product_modules, public.product_evidence to service_role;
grant update (embedding, embedding_model) on public.product_evidence to service_role;
grant insert on public.chat_feedback to service_role;

create index product_evidence_module_idx on public.product_evidence (module_id);

create function public.match_product_evidence(
  query_embedding extensions.vector(384),
  filter_module text default null,
  match_count int default 6
) returns table (id text, module_id text, section text, body text, tags text[], source_url text, similarity double precision)
language sql stable security invoker set search_path = '' as $$
  select p.id, p.module_id, p.section, p.body, p.tags, p.source_url,
         1 - (p.embedding operator(extensions.<=>) query_embedding)
  from public.product_evidence p
  where p.embedding is not null and p.embedding_model = 'gte-small'
    and (filter_module is null or p.module_id = filter_module)
  order by p.embedding operator(extensions.<=>) query_embedding, p.id
  limit greatest(1, least(coalesce(match_count, 6), 20));
$$;

revoke all on function public.match_product_evidence(extensions.vector, text, int) from public, anon, authenticated;
grant execute on function public.match_product_evidence(extensions.vector, text, int) to service_role;

