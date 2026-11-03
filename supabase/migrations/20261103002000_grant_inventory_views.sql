-- Inventario: las pantallas de Taller necesitan leer esta vista con la sesión autenticada.
grant select on table public.v_taller_reparacion_pendientes to authenticated, service_role;

-- La vista de flota consulta asignaciones activas para mostrar el responsable.
grant select on table public.vehiculo_asignaciones to authenticated, service_role;
grant select on table public.vehiculos to authenticated, service_role;
grant select on table public.vehiculos_alertas to authenticated, service_role;
grant select on table public.vehiculo_seguros, public.vehiculo_itv, public.vehiculo_mantenimientos, public.vehiculo_km_registro to authenticated, service_role;
