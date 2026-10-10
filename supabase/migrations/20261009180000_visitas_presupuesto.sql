-- Borradores de presupuesto obtenidos de notas o transcripciones de visita.
-- La fuente original se conserva para que cada propuesta pueda auditarse.

create table if not exists public.visitas_presupuesto (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  titulo text not null default 'Visita a cliente',
  fuente_tipo text not null default 'manual',
  fuente_nombre text,
  notas_originales text not null,
  resumen text,
  necesidades_cliente jsonb not null default '[]'::jsonb,
  datos_pendientes jsonb not null default '[]'::jsonb,
  observaciones jsonb not null default '[]'::jsonb,
  estado text not null default 'borrador',
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint visitas_presupuesto_fuente_check
    check (fuente_tipo in ('manual', 'plaud_transcripcion', 'plaud_resumen')),
  constraint visitas_presupuesto_estado_check
    check (estado in ('borrador', 'revisado', 'confirmado')),
  constraint visitas_presupuesto_notas_check
    check (char_length(btrim(notas_originales)) > 0)
);

create index if not exists visitas_presupuesto_lead_idx
  on public.visitas_presupuesto (lead_id, created_at desc);

create table if not exists public.visita_presupuesto_partidas (
  id uuid primary key default gen_random_uuid(),
  visita_id uuid not null references public.visitas_presupuesto(id) on delete cascade,
  sistema_id uuid references public.sistemas_rendimiento(id) on delete set null,
  codigo_snapshot text,
  capitulo_snapshot text,
  descripcion text not null,
  zona text,
  unidad text,
  cantidad numeric(14,4),
  texto_origen text,
  confianza numeric(5,4),
  estado_revision text not null default 'propuesta',
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint visita_partida_descripcion_check check (char_length(btrim(descripcion)) > 0),
  constraint visita_partida_cantidad_check check (cantidad is null or cantidad > 0),
  constraint visita_partida_confianza_check check (confianza is null or confianza between 0 and 1),
  constraint visita_partida_estado_check
    check (estado_revision in ('propuesta', 'confirmada', 'descartada', 'sin_coincidencia'))
);

create index if not exists visita_presupuesto_partidas_visita_idx
  on public.visita_presupuesto_partidas (visita_id, orden);

create or replace function public.puede_gestionar_visita_presupuesto(p_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.leads l
    where l.id = p_lead_id
      and (
        public.app_is_admin_or_encargado()
        or l.owner_user_id = auth.uid()
        or l.created_by = auth.uid()
        or l.empleado_asignado_id = public.app_current_empleado_id()
        or exists (
          select 1
          from public.leads_asignaciones la
          where la.lead_id = l.id
            and la.usuario_id = auth.uid()
        )
      )
  );
$$;

alter table public.visitas_presupuesto enable row level security;
alter table public.visita_presupuesto_partidas enable row level security;

drop policy if exists visitas_presupuesto_gestion on public.visitas_presupuesto;
create policy visitas_presupuesto_gestion on public.visitas_presupuesto
for all to authenticated
using (public.puede_gestionar_visita_presupuesto(lead_id))
with check (public.puede_gestionar_visita_presupuesto(lead_id));

drop policy if exists visita_presupuesto_partidas_gestion on public.visita_presupuesto_partidas;
create policy visita_presupuesto_partidas_gestion on public.visita_presupuesto_partidas
for all to authenticated
using (
  exists (
    select 1
    from public.visitas_presupuesto vp
    where vp.id = visita_id
      and public.puede_gestionar_visita_presupuesto(vp.lead_id)
  )
)
with check (
  exists (
    select 1
    from public.visitas_presupuesto vp
    where vp.id = visita_id
      and public.puede_gestionar_visita_presupuesto(vp.lead_id)
  )
);

grant select, insert, update, delete on public.visitas_presupuesto to authenticated, service_role;
grant select, insert, update, delete on public.visita_presupuesto_partidas to authenticated, service_role;
grant execute on function public.puede_gestionar_visita_presupuesto(uuid) to authenticated, service_role;

comment on table public.visitas_presupuesto is
  'Borradores trazables creados a partir de notas o transcripciones de una visita comercial.';
comment on table public.visita_presupuesto_partidas is
  'Partidas propuestas para un presupuesto, vinculadas cuando sea posible a la biblioteca normalizada.';
