-- Expone los costes horarios genericos solo a administracion/encargados.
-- Evita conceder SELECT directo sobre la tabla a todos los usuarios autenticados.

create or replace function public.api_costes_horarios_rendimientos()
returns table (
  id uuid,
  rol text,
  tipo_hora text,
  coste_hora numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.app_is_admin_or_encargado() then
    raise exception 'Acceso restringido a administracion';
  end if;

  return query
  select ch.id, ch.rol, ch.tipo_hora, ch.coste_hora
  from public.costes_horarios ch
  order by ch.rol, ch.tipo_hora;
end;
$$;

revoke all on function public.api_costes_horarios_rendimientos() from public;
grant execute on function public.api_costes_horarios_rendimientos() to authenticated, service_role;

