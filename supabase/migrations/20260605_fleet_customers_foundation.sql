alter table public.customers
  add column if not exists legal_name text,
  add column if not exists trade_name text,
  add column if not exists email text,
  add column if not exists document text,
  add column if not exists document_type text,
  add column if not exists state_registration text,
  add column if not exists municipal_registration text,
  add column if not exists postal_code text,
  add column if not exists street text,
  add column if not exists street_number text,
  add column if not exists complement text,
  add column if not exists neighborhood text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists contact_phone_1 text,
  add column if not exists contact_phone_2 text;

create index if not exists customers_tenant_document_idx
  on public.customers (tenant_id, document);

alter table public.attendances
  add column if not exists billing_mode text not null default 'standard',
  add column if not exists billing_due_date date;

create index if not exists attendances_tenant_billing_due_date_idx
  on public.attendances (tenant_id, billing_due_date);
