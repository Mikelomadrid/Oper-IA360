-- Equipo operativo de cada obra.
-- El encargado selecciona el conjunto de personas que puede participar en la obra.
-- Las asignaciones concretas a tareas siguen viviendo en tarea_empleados.

create table if not exists public.obra_equipo (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  empleado_id uuid not null references public.empleados(id) on delete restrict,
  rol_equipo text not null default 'tecnico',
  activo boolean not null default true,
  asignado_por uuid default auth.uid(),
  asignado_en timestamptz not null default now(),
  notas text,
  constraint obra_equipo_rol_chk check (rol_equipo in ('responsable', 'tecnico')),
  constraint obra_equipo_proyecto_empleado_uk unique (proyecto_id, empleado_id)
);

create index if not exists obra_equipo_proyecto_idx
  on public.obra_equipo(proyecto_id)
  where activo;

create index if not exists obra_equipo_empleado_idx
  on public.obra_equipo(empleado_id)
  where activo;

comment on table public.obra_equipo is
  'Personal preseleccionado por el encargado para una obra. No asigna automaticamente tareas.';
comment on column public.obra_equipo.rol_equipo is
  'Responsabilidad dentro de esta obra; no modifica el rol general del empleado.';

alter table public.obra_equipo enable row level security;

drop policy if exists obra_equipo_lectura on public.obra_equipo;
create policy obra_equipo_lectura
on public.obra_equipo
for select
to authenticated
using (true);

drop policy if exists obra_equipo_gestion on public.obra_equipo;
create policy obra_equipo_gestion
on public.obra_equipo
for all
to authenticated
using (public.app_is_admin_or_encargado())
with check (public.app_is_admin_or_encargado());

grant select on public.obra_equipo to authenticated;
grant insert, update, delete on public.obra_equipo to authenticated;
grant all on public.obra_equipo to service_role;

