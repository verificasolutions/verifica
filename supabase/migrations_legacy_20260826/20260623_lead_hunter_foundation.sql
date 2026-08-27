create table if not exists public.lead_companies (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  business_type text not null,
  phone text,
  address text,
  city text,
  state text,
  latitude double precision,
  longitude double precision,
  website text,
  google_maps_url text,
  rating numeric(3,2),
  review_count integer not null default 0,
  source text not null,
  raw_data jsonb not null default '{}'::jsonb,
  opportunity_score integer not null default 0,
  opportunity_level text not null default 'baixa' check (opportunity_level in ('baixa', 'media', 'alta')),
  status text not null default 'found' check (status in ('found', 'analyzed', 'message_generated', 'contacted', 'responded', 'demo_scheduled', 'closed_won', 'lost')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists lead_companies_business_name_idx
on public.lead_companies (business_name);

create index if not exists lead_companies_city_state_idx
on public.lead_companies (city, state);

create index if not exists lead_companies_status_idx
on public.lead_companies (status, opportunity_level, opportunity_score desc);

drop trigger if exists set_lead_companies_updated_at on public.lead_companies;
create trigger set_lead_companies_updated_at
before update on public.lead_companies
for each row execute function public.set_updated_at();

create table if not exists public.lead_analysis (
  id uuid primary key default gen_random_uuid(),
  lead_company_id uuid not null references public.lead_companies (id) on delete cascade,
  has_website boolean not null default false,
  has_phone boolean not null default false,
  has_google_maps boolean not null default false,
  has_instagram boolean not null default false,
  instagram_url text,
  has_low_reviews boolean not null default false,
  has_poor_presence boolean not null default false,
  problems_found text[] not null default '{}',
  opportunity_reason text,
  ai_summary text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists lead_analysis_company_idx
on public.lead_analysis (lead_company_id, created_at desc);

create table if not exists public.lead_messages (
  id uuid primary key default gen_random_uuid(),
  lead_company_id uuid not null references public.lead_companies (id) on delete cascade,
  message_text text not null,
  message_type text not null default 'whatsapp',
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists lead_messages_company_idx
on public.lead_messages (lead_company_id, created_at desc);

create table if not exists public.lead_hunter_jobs (
  id uuid primary key default gen_random_uuid(),
  niche text not null,
  city text not null,
  state text not null,
  radius_km integer not null,
  max_results integer not null,
  total_found integer not null default 0,
  total_saved integer not null default 0,
  total_duplicates integer not null default 0,
  status text not null default 'running' check (status in ('running', 'finished', 'failed')),
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz
);

create index if not exists lead_hunter_jobs_created_idx
on public.lead_hunter_jobs (created_at desc);

alter table public.lead_companies enable row level security;
alter table public.lead_analysis enable row level security;
alter table public.lead_messages enable row level security;
alter table public.lead_hunter_jobs enable row level security;
