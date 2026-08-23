create table if not exists public.lead_company_activities (
  id uuid primary key default gen_random_uuid(),
  lead_company_id uuid not null references public.lead_companies (id) on delete cascade,
  activity_type text not null,
  channel text,
  note text,
  created_by_email text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists lead_company_activities_company_idx
on public.lead_company_activities (lead_company_id, created_at desc);

alter table public.lead_company_activities enable row level security;
