create table if not exists public.message_dispatch_queue (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  attendance_id uuid null references public.attendances(id) on delete set null,
  customer_id uuid null references public.customers(id) on delete set null,
  stage text not null check (stage in ('queue', 'washing', 'finishing', 'ready')),
  whatsapp text not null,
  text text not null,
  media_url text null,
  media_mime_type text null,
  media_file_name text null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts integer not null default 0,
  last_error text null,
  processing_started_at timestamptz null,
  sent_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists message_dispatch_queue_status_created_idx
  on public.message_dispatch_queue (status, created_at);

create index if not exists message_dispatch_queue_tenant_idx
  on public.message_dispatch_queue (tenant_id, created_at desc);

alter table public.message_dispatch_queue enable row level security;

drop policy if exists "tenant members can read their own message dispatch queue" on public.message_dispatch_queue;
create policy "tenant members can read their own message dispatch queue"
  on public.message_dispatch_queue
  for select
  using (
    exists (
      select 1
      from public.tenant_users m
      where m.tenant_id = message_dispatch_queue.tenant_id
        and m.user_id = auth.uid()
        and m.is_active = true
    )
  );

create or replace function public.claim_message_dispatch_batch(p_limit integer default 10)
returns setof public.message_dispatch_queue
language sql
security definer
set search_path = public
as $$
  with picked as (
    select id
    from public.message_dispatch_queue
    where (
      status = 'pending'
      or (status = 'processing' and processing_started_at < now() - interval '2 minutes')
    )
    order by created_at asc
    limit greatest(coalesce(p_limit, 10), 1)
    for update skip locked
  )
  update public.message_dispatch_queue q
  set status = 'processing',
      attempts = q.attempts + 1,
      processing_started_at = now(),
      updated_at = now()
  from picked
  where q.id = picked.id
  returning q.*;
$$;

grant execute on function public.claim_message_dispatch_batch(integer) to authenticated, service_role;
