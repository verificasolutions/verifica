-- Portal do Cliente — Extensão de auditoria para actor de cliente.
-- Eventos em formato entity.action (precedente: commercial_intake.payment_confirmed).
-- Nesta fase: customer.login, customer.register, customer.session_revoked, vehicle.linked,
-- vehicle.unlinked, vehicle.lookup, order.created, payment_intent.created, loyalty.entry.created,
-- loyalty.reward.used, loyalty.reward.reverted, appointment.created.
-- payment.confirmed NÃO é emitido na Fase 2 (sem gateway) — reservado para tenants online_required.

alter table public.audit_logs
  add column if not exists actor_customer_id uuid references public.customers (id) on delete set null;

create index if not exists audit_logs_actor_customer_idx
  on public.audit_logs (actor_customer_id);
