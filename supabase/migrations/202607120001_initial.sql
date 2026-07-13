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
  status text not null default 'new',
  payload jsonb not null,
  response_payload jsonb,
  consent_at timestamptz not null,
  created_at timestamptz not null default now()
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
  yard boolean not null default false,
  garden boolean not null default false,
  pool boolean not null default false,
  amenities jsonb not null default '[]'::jsonb,
  source_name text not null,
  source_url text not null default '',
  demo boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.leads enable row level security;
alter table public.properties enable row level security;
revoke all on public.leads from anon, authenticated;
revoke all on public.properties from anon, authenticated;
create index if not exists properties_search_idx on public.properties(transaction_type,property_type,city,price);
