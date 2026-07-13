-- Círculo Internacional de Bienes Raíces
-- Ejecutar con Supabase CLI o desde el SQL Editor del proyecto.

create extension if not exists pgcrypto;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  transaction_type text not null check (transaction_type in ('rent','buy')),
  full_name text not null,
  email text not null,
  phone text not null,
  city text not null,
  budget_min numeric not null default 0,
  budget_max numeric not null,
  status text not null default 'new' check (status in ('new','analyzed','with_matches','without_matches','contacted')),
  payload jsonb not null,
  response_payload jsonb,
  consent_at timestamptz not null,
  analyzed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.searches (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  criteria jsonb not null,
  analysis jsonb,
  result_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.providers (
  id text primary key,
  position integer not null default 0,
  name text not null,
  base_url text not null default '',
  integration_type text not null check (integration_type in ('authorized_api','csv_feed','json_feed','search_link','manual')),
  enabled boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.properties (
  id text primary key,
  title text not null,
  transaction_type text not null check (transaction_type in ('rent','buy')),
  property_type text not null check (property_type in ('house','apartment','land')),
  city text not null,
  neighborhood text not null default '',
  price numeric not null check (price >= 0),
  bedrooms numeric not null default 0,
  bathrooms numeric not null default 0,
  parking integer not null default 0,
  land_area numeric not null default 0,
  construction_area numeric not null default 0,
  floors integer not null default 0,
  furnished text check (furnished is null or furnished in ('furnished','semi','unfurnished')),
  yard boolean not null default false,
  garden boolean not null default false,
  pool boolean not null default false,
  amenities jsonb not null default '[]'::jsonb,
  source_name text not null,
  source_url text not null default '',
  verified_at timestamptz,
  demo boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.search_results (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.searches(id) on delete cascade,
  property_id text references public.properties(id) on delete set null,
  match_score integer not null check (match_score between 0 and 100),
  reasons jsonb not null default '[]'::jsonb,
  gaps jsonb not null default '[]'::jsonb,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists leads_created_at_idx on public.leads(created_at desc);
create index if not exists leads_status_idx on public.leads(status);
create index if not exists properties_search_idx on public.properties(transaction_type, property_type, city, price);
create index if not exists searches_lead_id_idx on public.searches(lead_id);

alter table public.leads enable row level security;
alter table public.searches enable row level security;
alter table public.providers enable row level security;
alter table public.properties enable row level security;
alter table public.search_results enable row level security;
alter table public.audit_logs enable row level security;

revoke all on public.leads from anon, authenticated;
revoke all on public.searches from anon, authenticated;
revoke all on public.providers from anon, authenticated;
revoke all on public.properties from anon, authenticated;
revoke all on public.search_results from anon, authenticated;
revoke all on public.audit_logs from anon, authenticated;

insert into public.providers (id, position, name, base_url, integration_type, enabled) values
  ('circulo', 1, 'Círculo Internacional de Bienes Raíces', '', 'manual', true),
  ('inmuebles24', 2, 'Inmuebles24', 'https://www.inmuebles24.com', 'search_link', true),
  ('vivanuncios', 3, 'Vivanuncios', 'https://www.vivanuncios.com.mx', 'search_link', true),
  ('facebook', 4, 'Facebook Marketplace', 'https://www.facebook.com/marketplace', 'search_link', true),
  ('provider-5', 5, 'Proveedor configurable 5', '', 'manual', false),
  ('provider-6', 6, 'Proveedor configurable 6', '', 'manual', false),
  ('provider-7', 7, 'Proveedor configurable 7', '', 'manual', false),
  ('provider-8', 8, 'Proveedor configurable 8', '', 'manual', false),
  ('provider-9', 9, 'Proveedor configurable 9', '', 'manual', false),
  ('provider-10', 10, 'Proveedor configurable 10', '', 'manual', false),
  ('provider-11', 11, 'Proveedor configurable 11', '', 'manual', false),
  ('provider-12', 12, 'Proveedor configurable 12', '', 'manual', false),
  ('provider-13', 13, 'Proveedor configurable 13', '', 'manual', false),
  ('provider-14', 14, 'Proveedor configurable 14', '', 'manual', false)
on conflict (id) do update set
  position = excluded.position,
  name = excluded.name,
  base_url = excluded.base_url,
  integration_type = excluded.integration_type;
