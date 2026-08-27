alter table public.operation_boxes
  add column if not exists sla_unit text not null default 'minutes';

do $$
begin
  alter table public.operation_boxes
    add constraint operation_boxes_sla_unit_check
    check (sla_unit in ('minutes', 'hours_minutes', 'days', 'weeks', 'months'));
exception
  when duplicate_object then null;
end $$;

update public.operation_boxes
set sla_unit = 'minutes'
where sla_unit is null or sla_unit not in ('minutes', 'hours_minutes', 'days', 'weeks', 'months');
