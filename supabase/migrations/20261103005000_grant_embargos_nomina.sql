-- Embargos: la ficha del empleado consulta el embargo y sus movimientos
-- mediante PostgREST. Las políticas RLS siguen restringiendo las filas.
grant select, insert, update, delete on table public.embargos to authenticated, service_role;
grant select, insert, update, delete on table public.embargos_retenciones to authenticated, service_role;
grant select, insert, update, delete on table public.embargos_pagos to authenticated, service_role;

