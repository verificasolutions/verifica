create or replace function public.claim_attendance_atomic(
  p_attendance_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attendance public.attendances%rowtype;
  v_employee_id uuid;
begin
  select *
  into v_attendance
  from public.attendances
  where id = p_attendance_id
  for update;

  if v_attendance.id is null then
    raise exception 'Atendimento não encontrado.';
  end if;

  if public.current_tenant_role(v_attendance.tenant_id) <> 'operator' then
    raise exception 'Acesso negado.';
  end if;

  v_employee_id := public.current_employee_id(v_attendance.tenant_id);

  if v_employee_id is null then
    raise exception 'Seu usuário não está vinculado a um funcionário.';
  end if;

  if v_attendance.status <> 'waiting' or v_attendance.employee_id is not null then
    raise exception 'Esse carro não está mais disponível para assumir.';
  end if;

  update public.attendances
  set employee_id = v_employee_id
  where id = v_attendance.id
    and tenant_id = v_attendance.tenant_id;

  return v_attendance.id;
end;
$$;

grant execute on function public.claim_attendance_atomic(uuid) to authenticated;
