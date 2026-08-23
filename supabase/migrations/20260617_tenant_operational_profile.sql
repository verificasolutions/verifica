alter table public.tenants
  add column if not exists operational_profile text not null default 'automotive';

do $$
begin
  alter table public.tenants
    add constraint tenants_operational_profile_check
    check (operational_profile in ('automotive', 'generic'));
exception
  when duplicate_object then null;
end $$;

update public.tenants
set operational_profile = 'automotive'
where operational_profile is null or operational_profile not in ('automotive', 'generic');
