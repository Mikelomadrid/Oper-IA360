-- Procedimiento de ejecucion ordenado de cada partida de rendimiento.
-- Las fases describen como se ejecuta la unidad; no son tareas de calendario.

create table if not exists public.sistema_rendimiento_fases (
  id uuid primary key default gen_random_uuid(),
  sistema_id uuid not null references public.sistemas_rendimiento(id) on delete cascade,
  orden integer not null default 1,
  nombre text not null,
  descripcion text,
  oficio text,
  horas_por_unidad numeric(12,4) not null default 0,
  obligatoria boolean not null default true,
  control_calidad text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sistema_fase_orden_valido check (orden >= 1),
  constraint sistema_fase_nombre_no_vacio check (btrim(nombre) <> ''),
  constraint sistema_fase_horas_validas check (horas_por_unidad >= 0)
);

create index if not exists sistema_rendimiento_fases_sistema_idx
  on public.sistema_rendimiento_fases (sistema_id, orden);

alter table public.sistema_rendimiento_fases enable row level security;

drop policy if exists sistema_rendimiento_fases_gestion on public.sistema_rendimiento_fases;
create policy sistema_rendimiento_fases_gestion on public.sistema_rendimiento_fases
for all to authenticated
using (public.app_is_admin_or_encargado())
with check (public.app_is_admin_or_encargado());

grant select, insert, update, delete on public.sistema_rendimiento_fases to authenticated, service_role;

comment on table public.sistema_rendimiento_fases is
  'Secuencia tecnica de ejecucion de una partida; independiente de las tareas operativas de obra.';

-- Procedimiento inicial acordado para la partida de prueba de tabique de pladur.
insert into public.sistema_rendimiento_fases
  (sistema_id, orden, nombre, oficio, obligatoria)
select s.id, fase.orden, fase.nombre, 'Pladurista', true
from public.sistemas_rendimiento s
cross join (values
  (1, 'Montar perfilería'),
  (2, 'Colocar placas'),
  (3, 'Encintar y aplicar pasta de juntas')
) as fase(orden, nombre)
where s.codigo = 'PLA-TAB-001'
  and not exists (
    select 1
    from public.sistema_rendimiento_fases existente
    where existente.sistema_id = s.id
  );
