create or replace function public.resolve_vehicle_size_tier(p_vehicle_type text, p_overrides jsonb)
returns text
language sql
stable
as $$
  select coalesce(
    nullif(p_overrides ->> p_vehicle_type, ''),
    case lower(trim(p_vehicle_type))
      when 'hatch' then 'passeio'
      when 'sedan' then 'medio'
      when 'wagon' then 'medio'
      when 'pickup_small' then 'grande'
      when 'suv' then 'grande'
      when 'pickup_large' then 'grande'
      when 'van' then 'bem_grande'
      when 'micro_bus' then 'bem_grande'
      when 'truck' then 'bem_grande'
      when 'bus' then 'bem_grande'
      else 'passeio'
    end
  );
$$;
