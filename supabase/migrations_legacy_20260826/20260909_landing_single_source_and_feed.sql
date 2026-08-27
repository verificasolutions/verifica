-- Landing — fonte única (Objetivo 1) + feed, galeria, likes e comentários (Objetivo 2).
-- Fonte única: tenant_company_profiles/tenants p/ nome, telefone, e-mail, endereço (com CEP),
-- cidade/estado e site. A landing NÃO sobrescreve esses campos (só bio, categoria, imagens,
-- redes, mensagem, tema, posts e avaliações). RLS preservada; sem grants anon em tabelas.

-- 1) tenant_company_profiles.website — fonte única para "site"
alter table public.tenant_company_profiles
  add column if not exists website text;

-- 2) tenant_landing_media — mídia ordenada por post/galeria (tenant-scoped; compatível com
--    marketing_assets.media_id, que segue apontando para a capa em attendance_media)
create table if not exists public.tenant_landing_media (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  marketing_asset_id uuid references public.marketing_assets (id) on delete set null,
  attendance_media_id uuid references public.attendance_media (id) on delete set null,
  file_path text not null,
  mime_type text not null default 'image/jpeg',
  kind text not null default 'post' check (kind in ('post', 'gallery')),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists tenant_landing_media_asset_sort_idx
  on public.tenant_landing_media (tenant_id, marketing_asset_id, sort_order);

create index if not exists tenant_landing_media_gallery_idx
  on public.tenant_landing_media (tenant_id, kind, created_at desc);

drop trigger if exists set_tenant_landing_media_updated_at on public.tenant_landing_media;
create trigger set_tenant_landing_media_updated_at
before update on public.tenant_landing_media
for each row execute function public.set_updated_at();

alter table public.tenant_landing_media enable row level security;

grant select, insert, update, delete on public.tenant_landing_media to authenticated;
-- a imagem Supabase concede privilégios padrão a anon; revogamos explicitamente (deny-by-default)
revoke all on public.tenant_landing_media from anon;

drop policy if exists "tenant users can read landing media" on public.tenant_landing_media;
create policy "tenant users can read landing media"
on public.tenant_landing_media
for select
to authenticated
using (public.is_tenant_member(tenant_id));

drop policy if exists "owners managers can manage landing media" on public.tenant_landing_media;
create policy "owners managers can manage landing media"
on public.tenant_landing_media
for all
to authenticated
using (public.is_tenant_owner_or_manager(tenant_id))
with check (public.is_tenant_owner_or_manager(tenant_id));

-- 3) landing_likes — idempotente por (tenant, asset, identity_hash); sem grant anon de tabela
create table if not exists public.landing_likes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  marketing_asset_id uuid not null references public.marketing_assets (id) on delete cascade,
  identity_hash text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (tenant_id, marketing_asset_id, identity_hash)
);

create index if not exists landing_likes_asset_idx
  on public.landing_likes (marketing_asset_id, created_at desc);

alter table public.landing_likes enable row level security;

grant select on public.landing_likes to authenticated;
revoke all on public.landing_likes from anon;

drop policy if exists "tenant users can read landing likes" on public.landing_likes;
create policy "tenant users can read landing likes"
on public.landing_likes
for select
to authenticated
using (public.is_tenant_member(tenant_id));

-- 4) landing_comments — sempre pending até aprovação; sem grant anon de tabela
create table if not exists public.landing_comments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  marketing_asset_id uuid not null references public.marketing_assets (id) on delete cascade,
  author_name text not null,
  author_identity_hash text not null,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  moderation_suggestion text,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists landing_comments_asset_status_idx
  on public.landing_comments (marketing_asset_id, status, created_at desc);

drop trigger if exists set_landing_comments_updated_at on public.landing_comments;
create trigger set_landing_comments_updated_at
before update on public.landing_comments
for each row execute function public.set_updated_at();

alter table public.landing_comments enable row level security;

grant select, update on public.landing_comments to authenticated;
revoke all on public.landing_comments from anon;

drop policy if exists "tenant users can read landing comments" on public.landing_comments;
create policy "tenant users can read landing comments"
on public.landing_comments
for select
to authenticated
using (public.is_tenant_member(tenant_id));

drop policy if exists "owners managers can review landing comments" on public.landing_comments;
create policy "owners managers can review landing comments"
on public.landing_comments
for update
to authenticated
using (public.is_tenant_owner_or_manager(tenant_id))
with check (public.is_tenant_owner_or_manager(tenant_id));

-- 5) RPCs públicas (anon/authenticated execute; validação, sanitização e rate limit no servidor)
create or replace function public.landing_like_post(p_marketing_asset_id uuid, p_identity_hash text)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid;
  v_count bigint;
begin
  if p_marketing_asset_id is null or p_identity_hash is null or length(p_identity_hash) < 16 then
    raise exception 'Dados inválidos.';
  end if;

  select tenant_id into v_tenant_id
  from public.marketing_assets
  where id = p_marketing_asset_id
    and status = 'approved';

  if v_tenant_id is null then
    raise exception 'Publicação inválida.';
  end if;

  insert into public.landing_likes (tenant_id, marketing_asset_id, identity_hash)
  values (v_tenant_id, p_marketing_asset_id, p_identity_hash)
  on conflict (tenant_id, marketing_asset_id, identity_hash) do nothing;

  select count(*) into v_count
  from public.landing_likes
  where marketing_asset_id = p_marketing_asset_id;

  return v_count;
end;
$$;

revoke all on function public.landing_like_post(uuid, text) from public;
grant execute on function public.landing_like_post(uuid, text) to anon, authenticated;

create or replace function public.landing_post_like_count(p_marketing_asset_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select count(*) from public.landing_likes where marketing_asset_id = p_marketing_asset_id;
$$;

revoke all on function public.landing_post_like_count(uuid) from public;
grant execute on function public.landing_post_like_count(uuid) to anon, authenticated;

create or replace function public.landing_comment_submit(p_marketing_asset_id uuid, p_author_name text, p_author_identity_hash text, p_body text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid;
  v_name text;
  v_body text;
  v_id uuid;
begin
  if p_marketing_asset_id is null or p_author_identity_hash is null or length(p_author_identity_hash) < 16 then
    raise exception 'Dados inválidos.';
  end if;

  -- sanitização básica server-side (a camada TS remove HTML/controla limites; aqui é a barreira final)
  v_name := btrim(regexp_replace(coalesce(p_author_name, ''), '[[:cntrl:]]', ' ', 'g'));
  v_body := btrim(regexp_replace(coalesce(p_body, ''), '[[:cntrl:]]', ' ', 'g'));

  if v_name = '' or length(v_name) > 60 then
    raise exception 'Nome inválido.';
  end if;

  if v_body = '' or length(v_body) > 500 then
    raise exception 'Comentário inválido.';
  end if;

  select tenant_id into v_tenant_id
  from public.marketing_assets
  where id = p_marketing_asset_id
    and status = 'approved';

  if v_tenant_id is null then
    raise exception 'Publicação inválida.';
  end if;

  insert into public.landing_comments (tenant_id, marketing_asset_id, author_name, author_identity_hash, body, status)
  values (v_tenant_id, p_marketing_asset_id, v_name, p_author_identity_hash, v_body, 'pending')
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.landing_comment_submit(uuid, text, text, text) from public;
grant execute on function public.landing_comment_submit(uuid, text, text, text) to anon, authenticated;

create or replace function public.landing_comments_approved(p_marketing_asset_id uuid)
returns table (id uuid, author_name text, body text, created_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id, c.author_name, c.body, c.created_at
  from public.landing_comments c
  where c.marketing_asset_id = p_marketing_asset_id
    and c.status = 'approved'
  order by c.created_at asc;
$$;

revoke all on function public.landing_comments_approved(uuid) from public;
grant execute on function public.landing_comments_approved(uuid) to anon, authenticated;
