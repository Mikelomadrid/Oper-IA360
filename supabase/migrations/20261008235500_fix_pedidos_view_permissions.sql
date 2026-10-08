begin;

-- La pantalla de Pedidos consulta esta vista desde el rol autenticado.
-- security_invoker conserva las politicas RLS de las tablas base:
-- administradores/encargados ven todo y cada tecnico solo sus solicitudes.
alter view public.v_solicitudes_material_detalle_v2
  set (security_invoker = true);

revoke all on table public.v_solicitudes_material_detalle_v2 from public, anon;
grant select on table public.v_solicitudes_material_detalle_v2 to authenticated, service_role;

-- Privilegios de tabla mínimos para que security_invoker pueda aplicar RLS.
-- Las políticas existentes deciden qué filas puede leer o crear cada usuario.
grant select, insert on table public.solicitudes_material to authenticated;
grant select, insert on table public.detalles_solicitud to authenticated;
grant select on table public.proyectos, public.partes, public.empleados to authenticated;

-- Selector usado por los filtros y el formulario de Pedidos.
alter view public.v_proyectos_selector
  set (security_invoker = true);

revoke all on table public.v_proyectos_selector from public, anon;
grant select on table public.v_proyectos_selector to authenticated, service_role;

commit;
