-- Permite que administradores y encargados usen las habilidades para formar
-- equipos de obra. La política histórica comparaba auth.role() con roles de
-- negocio y por eso denegaba el acceso incluso a usuarios autorizados.

grant select on table public.empleado_habilidades to authenticated;
grant select on table public.ausencias_empleados to authenticated;
grant select on table public.tarea_empleados to authenticated;

create policy empleado_habilidades_equipo_obra_select
on public.empleado_habilidades
for select
to authenticated
using (public.app_is_admin_or_encargado());

