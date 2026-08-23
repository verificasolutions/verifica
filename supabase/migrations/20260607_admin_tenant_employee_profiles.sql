alter table public.employees
  add column if not exists email text,
  add column if not exists contact_phone text,
  add column if not exists cpf text,
  add column if not exists birth_date date,
  add column if not exists postal_code text,
  add column if not exists street text,
  add column if not exists street_number text,
  add column if not exists complement text,
  add column if not exists neighborhood text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists internal_code text;

create index if not exists employees_tenant_internal_code_idx
  on public.employees (tenant_id, internal_code);

create unique index if not exists employees_tenant_cpf_unique
  on public.employees (tenant_id, cpf)
  where cpf is not null and cpf <> '';
