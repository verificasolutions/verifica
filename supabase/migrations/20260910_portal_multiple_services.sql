-- Portal: permite contratar varios servicos principais na mesma ordem.
-- Reaproveita a funcao canonica e altera somente as validacoes de cardinalidade.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(p.oid)
    into v_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'customer_confirm_order'
    and pg_get_function_identity_arguments(p.oid) = 'p_token_hash text, p_vehicle_id uuid, p_service_ids uuid[], p_idempotency_key uuid, p_reward_id uuid';

  if v_definition is null then
    raise exception 'Funcao public.customer_confirm_order nao encontrada.';
  end if;

  v_definition := replace(v_definition, 'if v_main_count <> 1 then', 'if v_main_count < 1 then');
  v_definition := replace(v_definition, 'Selecione exatamente 1 serviço principal.', 'Selecione ao menos 1 serviço principal.');
  v_definition := replace(v_definition, '1 principal + até 3 complementos', 'até 4 serviços, sendo no máximo 3 complementos');
  execute v_definition;
end;
$$;
