-- Festive-season event marketplace: isolated admin-managed records, no fabricated event data.
create table if not exists public.event_organizers (
  id uuid primary key default gen_random_uuid(),
  organization_name text not null,
  contact_name text not null,
  contact_email text not null,
  contact_phone text,
  status text not null default 'pending_review' check (status in ('pending_review','approved','suspended','rejected')),
  admin_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  monthly_price_zar numeric(10,2) not null default 0 check (monthly_price_zar >= 0),
  description text not null default '',
  promoted_placement boolean not null default false,
  monthly_impression_limit integer check (monthly_impression_limit is null or monthly_impression_limit >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.event_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.event_organizers(id) on delete restrict,
  plan_id uuid not null references public.event_subscription_plans(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','trialing','active','past_due','cancelled','expired')),
  starts_at timestamptz,
  renews_at timestamptz,
  external_billing_reference text,
  admin_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.event_organizers(id) on delete restrict,
  title text not null,
  slug text not null unique,
  category text not null default 'other',
  description text not null default '',
  venue_name text not null,
  address text not null,
  latitude double precision,
  longitude double precision,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  image_url text,
  ticket_url text,
  status text not null default 'pending_review' check (status in ('draft','pending_review','approved','rejected','cancelled','completed')),
  promoted boolean not null default false,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.event_engagement_metrics (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.marketplace_events(id) on delete cascade,
  metric_type text not null check (metric_type in ('impression','detail_view','parking_search','parking_booking_click','ticket_click')),
  occurred_at timestamptz not null default now(),
  session_hash text
);

alter table public.event_organizers enable row level security;
alter table public.event_subscription_plans enable row level security;
alter table public.event_subscriptions enable row level security;
alter table public.marketplace_events enable row level security;
alter table public.event_engagement_metrics enable row level security;

revoke all on public.event_organizers, public.event_subscription_plans, public.event_subscriptions, public.marketplace_events, public.event_engagement_metrics from anon, authenticated;
grant all on public.event_organizers, public.event_subscription_plans, public.event_subscriptions, public.marketplace_events, public.event_engagement_metrics to service_role;

create index if not exists marketplace_events_public_map_idx on public.marketplace_events(status, starts_at, ends_at);
create index if not exists marketplace_events_geo_idx on public.marketplace_events(latitude, longitude);
create index if not exists marketplace_events_organizer_idx on public.marketplace_events(organizer_id, created_at desc);
create index if not exists event_subscriptions_status_idx on public.event_subscriptions(status, renews_at);
create index if not exists event_engagement_event_time_idx on public.event_engagement_metrics(event_id, occurred_at desc);
