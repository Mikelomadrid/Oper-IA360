-- El selector de fichaje debe respetar el equipo operativo actual de la obra.
-- Se mantiene compatibilidad con la antigua tabla proyectos_empleados.

create or replace function public.rpc_selector_proyectos_fichaje_tecnico()
returns table(value uuid, label text)
language sql
security definer
set search_path = public, pg_temp
as $$
  select distinct p.id as value, p.nombre_proyecto as label
  from public.proyectos p
  join public.empleados e
    on e.auth_user_id = auth.uid()
  where p.estado in ('activo', 'en_espera')
    and (
      exists (
        select 1
        from public.obra_equipo oe
        where oe.proyecto_id = p.id
          and oe.empleado_id = e.id
          and oe.activo = true
      )
      or exists (
        select 1
        from public.proyectos_empleados pe
        where pe.proyecto_id = p.id
          and pe.empleado_id = e.id
      )
    )
  order by label;
$$;

comment on function public.rpc_selector_proyectos_fichaje_tecnico() is
  'Devuelve las obras activas o en espera del equipo actual del tecnico, con compatibilidad para asignaciones antiguas.';

grant execute on function public.rpc_selector_proyectos_fichaje_tecnico() to authenticated;
