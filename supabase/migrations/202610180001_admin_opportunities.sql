create table if not exists public.admin_opportunities (
  id uuid primary key default gen_random_uuid(),
  opportunity_type text not null check (opportunity_type in ('event','ev_charger','wash_service')),
  title text not null,
  location text not null default '',
  latitude double precision,
  longitude double precision,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'research' check (status in ('research','verified','contacted','active','closed')),
  source_url text,
  confidence text not null default 'unverified' check (confidence in ('unverified','partially_verified','verified')),
  estimated_demand integer,
  nearby_supply integer,
  notes text not null default '',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.admin_opportunities enable row level security;
revoke all on public.admin_opportunities from anon, authenticated;
grant all on public.admin_opportunities to service_role;
create index if not exists admin_opportunities_type_status_idx on public.admin_opportunities(opportunity_type,status);
create index if not exists admin_opportunities_starts_at_idx on public.admin_opportunities(starts_at);
