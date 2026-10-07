-- Permisos mínimos del backend para el conector de facturas recibidas.
-- La Edge Function valida primero la sesión y el rol del empleado.

grant select on table public.empleados to service_role;
grant select, update on table public.facturas_gastos to service_role;
grant select on table public.facturas_gastos_ocr to service_role;
grant select, update on table public.facturas_gastos_contasimple_control to service_role;

grant execute on function public.flopy_actualizar_resultado_ocr_contasimple(
  uuid,
  text,
  bigint,
  text,
  numeric,
  text,
  jsonb
) to service_role;

grant execute on function public.flopy_registrar_envio_ocr_contasimple(
  uuid,
  bigint,
  text,
  text,
  text,
  uuid,
  text,
  jsonb
) to service_role;
