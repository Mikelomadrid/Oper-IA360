-- Biblioteca de sistemas constructivos y rendimientos.
-- Define lo necesario para ejecutar una unidad de trabajo sin alterar historicos
-- cuando cambien los precios de materiales o los costes horarios.

create table if not exists public.sistemas_rendimiento (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  nombre text not null,
  categoria text not null default 'otros',
  unidad_base text not null default 'ud',
  descripcion text,
  merma_general_pct numeric(7,3) not null default 0,
  estado text not null default 'borrador',
  version integer not null default 1,
  activo boolean not null default true,
  created_by uuid references public.empleados(id) on delete set null,
  validated_by uuid references public.empleados(id) on delete set null,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sistemas_rendimiento_codigo_no_vacio check (btrim(codigo) <> ''),
  constraint sistemas_rendimiento_nombre_no_vacio check (btrim(nombre) <> ''),
  constraint sistemas_rendimiento_unidad_no_vacia check (btrim(unidad_base) <> ''),
  constraint sistemas_rendimiento_merma_valida check (merma_general_pct between 0 and 100),
  constraint sistemas_rendimiento_estado_valido check (estado in ('borrador', 'validado', 'inactivo')),
  constraint sistemas_rendimiento_version_valida check (version >= 1)
);

create unique index if not exists sistemas_rendimiento_codigo_uidx
  on public.sistemas_rendimiento (lower(btrim(codigo)));
create index if not exists sistemas_rendimiento_categoria_idx
  on public.sistemas_rendimiento (categoria, estado);

create table if not exists public.sistema_rendimiento_materiales (
  id uuid primary key default gen_random_uuid(),
  sistema_id uuid not null references public.sistemas_rendimiento(id) on delete cascade,
  material_id uuid references public.materiales(id) on delete set null,
  descripcion text not null,
  referencia text,
  unidad text not null default 'ud',
  cantidad_por_unidad numeric(14,4) not null,
  merma_pct numeric(7,3) not null default 0,
  precio_unitario_referencia numeric(14,4) not null default 0,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sistema_material_descripcion_no_vacia check (btrim(descripcion) <> ''),
  constraint sistema_material_cantidad_positiva check (cantidad_por_unidad > 0),
  constraint sistema_material_merma_valida check (merma_pct between 0 and 100),
  constraint sistema_material_precio_valido check (precio_unitario_referencia >= 0)
);

create index if not exists sistema_rendimiento_materiales_sistema_idx
  on public.sistema_rendimiento_materiales (sistema_id, orden);

create table if not exists public.sistema_rendimiento_mano_obra (
  id uuid primary key default gen_random_uuid(),
  sistema_id uuid not null references public.sistemas_rendimiento(id) on delete cascade,
  oficio text not null,
  rol_referencia text,
  tipo_hora text not null default 'ordinaria',
  horas_por_unidad numeric(12,4) not null,
  coste_hora_referencia numeric(12,4) not null default 0,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sistema_mo_oficio_no_vacio check (btrim(oficio) <> ''),
  constraint sistema_mo_horas_positivas check (horas_por_unidad > 0),
  constraint sistema_mo_coste_valido check (coste_hora_referencia >= 0)
);

create index if not exists sistema_rendimiento_mano_obra_sistema_idx
  on public.sistema_rendimiento_mano_obra (sistema_id, orden);

create table if not exists public.sistema_rendimiento_otros_costes (
  id uuid primary key default gen_random_uuid(),
  sistema_id uuid not null references public.sistemas_rendimiento(id) on delete cascade,
  tipo text not null default 'otro',
  descripcion text not null,
  unidad text not null default 'ud',
  cantidad_por_unidad numeric(14,4) not null default 1,
  coste_unitario_referencia numeric(14,4) not null default 0,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sistema_otro_tipo_valido check (tipo in ('maquinaria', 'subcontrata', 'transporte', 'otro')),
  constraint sistema_otro_descripcion_no_vacia check (btrim(descripcion) <> ''),
  constraint sistema_otro_cantidad_positiva check (cantidad_por_unidad > 0),
  constraint sistema_otro_coste_valido check (coste_unitario_referencia >= 0)
);

create index if not exists sistema_rendimiento_otros_costes_sistema_idx
  on public.sistema_rendimiento_otros_costes (sistema_id, orden);

-- Medicion real: permite aprender rendimientos al ejecutar obras. La interfaz
-- de captura se activara en la siguiente fase, pero el modelo ya queda estable.
create table if not exists public.obra_sistema_mediciones (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.proyectos(id) on delete cascade,
  sistema_id uuid not null references public.sistemas_rendimiento(id) on delete restrict,
  fecha date not null default current_date,
  zona text,
  cantidad_ejecutada numeric(14,4) not null,
  unidad text not null,
  coste_materiales_snapshot numeric(14,2) not null default 0,
  coste_mano_obra_snapshot numeric(14,2) not null default 0,
  coste_otros_snapshot numeric(14,2) not null default 0,
  notas text,
  created_by uuid references public.empleados(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obra_sistema_medicion_cantidad_positiva check (cantidad_ejecutada > 0)
);

create index if not exists obra_sistema_mediciones_obra_fecha_idx
  on public.obra_sistema_mediciones (obra_id, fecha desc);
create index if not exists obra_sistema_mediciones_sistema_idx
  on public.obra_sistema_mediciones (sistema_id, fecha desc);

create or replace view public.v_sistemas_rendimiento_costes
with (security_invoker = true)
as
select
  s.id,
  coalesce(m.coste_materiales, 0)::numeric(14,4) as coste_materiales,
  coalesce(m.cantidad_materiales, 0)::numeric(14,4) as cantidad_materiales,
  coalesce(m.numero_materiales, 0)::bigint as numero_materiales,
  coalesce(mo.coste_mano_obra, 0)::numeric(14,4) as coste_mano_obra,
  coalesce(mo.horas_mano_obra, 0)::numeric(14,4) as horas_mano_obra,
  coalesce(mo.numero_oficios, 0)::bigint as numero_oficios,
  coalesce(o.coste_otros, 0)::numeric(14,4) as coste_otros,
  (
    coalesce(m.coste_materiales, 0)
    + coalesce(mo.coste_mano_obra, 0)
    + coalesce(o.coste_otros, 0)
  )::numeric(14,4) as coste_total
from public.sistemas_rendimiento s
left join lateral (
  select
    sum(rm.cantidad_por_unidad * (1 + (rm.merma_pct + s.merma_general_pct) / 100) * rm.precio_unitario_referencia) as coste_materiales,
    sum(rm.cantidad_por_unidad * (1 + (rm.merma_pct + s.merma_general_pct) / 100)) as cantidad_materiales,
    count(*) as numero_materiales
  from public.sistema_rendimiento_materiales rm
  where rm.sistema_id = s.id
) m on true
left join lateral (
  select
    sum(rmo.horas_por_unidad * rmo.coste_hora_referencia) as coste_mano_obra,
    sum(rmo.horas_por_unidad) as horas_mano_obra,
    count(*) as numero_oficios
  from public.sistema_rendimiento_mano_obra rmo
  where rmo.sistema_id = s.id
) mo on true
left join lateral (
  select sum(ro.cantidad_por_unidad * ro.coste_unitario_referencia) as coste_otros
  from public.sistema_rendimiento_otros_costes ro
  where ro.sistema_id = s.id
) o on true;

alter table public.sistemas_rendimiento enable row level security;
alter table public.sistema_rendimiento_materiales enable row level security;
alter table public.sistema_rendimiento_mano_obra enable row level security;
alter table public.sistema_rendimiento_otros_costes enable row level security;
alter table public.obra_sistema_mediciones enable row level security;

drop policy if exists sistemas_rendimiento_gestion on public.sistemas_rendimiento;
create policy sistemas_rendimiento_gestion on public.sistemas_rendimiento
for all to authenticated
using (public.app_is_admin_or_encargado())
with check (public.app_is_admin_or_encargado());

drop policy if exists sistema_rendimiento_materiales_gestion on public.sistema_rendimiento_materiales;
create policy sistema_rendimiento_materiales_gestion on public.sistema_rendimiento_materiales
for all to authenticated
using (public.app_is_admin_or_encargado())
with check (public.app_is_admin_or_encargado());

drop policy if exists sistema_rendimiento_mano_obra_gestion on public.sistema_rendimiento_mano_obra;
create policy sistema_rendimiento_mano_obra_gestion on public.sistema_rendimiento_mano_obra
for all to authenticated
using (public.app_is_admin_or_encargado())
with check (public.app_is_admin_or_encargado());

drop policy if exists sistema_rendimiento_otros_costes_gestion on public.sistema_rendimiento_otros_costes;
create policy sistema_rendimiento_otros_costes_gestion on public.sistema_rendimiento_otros_costes
for all to authenticated
using (public.app_is_admin_or_encargado())
with check (public.app_is_admin_or_encargado());

drop policy if exists obra_sistema_mediciones_gestion on public.obra_sistema_mediciones;
create policy obra_sistema_mediciones_gestion on public.obra_sistema_mediciones
for all to authenticated
using (public.app_is_admin_or_encargado())
with check (public.app_is_admin_or_encargado());

grant select, insert, update, delete on public.sistemas_rendimiento to authenticated, service_role;
grant select, insert, update, delete on public.sistema_rendimiento_materiales to authenticated, service_role;
grant select, insert, update, delete on public.sistema_rendimiento_mano_obra to authenticated, service_role;
grant select, insert, update, delete on public.sistema_rendimiento_otros_costes to authenticated, service_role;
grant select, insert, update, delete on public.obra_sistema_mediciones to authenticated, service_role;
grant select on public.v_sistemas_rendimiento_costes to authenticated, service_role;

comment on table public.sistemas_rendimiento is
  'Biblioteca versionable de sistemas constructivos expresados por una unidad base.';
comment on table public.obra_sistema_mediciones is
  'Mediciones reales para comparar rendimientos previstos y ejecutados sin reescribir historicos.';
