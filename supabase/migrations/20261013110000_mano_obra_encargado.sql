-- Los costes de mano de obra contienen datos sensibles de empleados.
-- Se exponen mediante una RPC que valida el rol funcional del usuario,
-- sin conceder acceso directo a la vista a todos los autenticados.

create or replace function public.api_proyecto_mano_obra_detalle(
  p_proyecto_id uuid
)
returns setof public.ui_v_proyecto_mano_obra_detalle_v2
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and not public.app_is_admin_or_encargado() then
    raise exception 'Solo administracion o el encargado pueden consultar los costes de mano de obra.'
      using errcode = '42501';
  end if;

  return query
  select detalle.*
  from public.ui_v_proyecto_mano_obra_detalle_v2 detalle
  where detalle.proyecto_id = p_proyecto_id;
end;
$$;

revoke all on function public.api_proyecto_mano_obra_detalle(uuid) from public;
grant execute on function public.api_proyecto_mano_obra_detalle(uuid)
  to authenticated, service_role;

comment on function public.api_proyecto_mano_obra_detalle(uuid) is
  'Detalle y costes de mano de obra de una obra, restringido a administracion y encargados.';
