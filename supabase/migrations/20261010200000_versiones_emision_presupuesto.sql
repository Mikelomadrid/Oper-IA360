-- Versiones inmutables emitidas desde los borradores de visita.
-- El borrador sigue siendo editable; cada emisión conserva una fotografía
-- completa y reutiliza el número aumentando la versión.

create table if not exists public.presupuesto_emisiones (
  id uuid primary key default gen_random_uuid(),
  visita_id uuid not null references public.visitas_presupuesto(id) on delete restrict,
  lead_id uuid not null references public.leads(id) on delete restrict,
  ejercicio integer not null,
  numero_secuencial integer not null,
  numero text not null,
  version integer not null,
  estado text not null default 'emitido',
  snapshot jsonb not null,
  base_partidas numeric(14,2) not null default 0,
  gastos_generales numeric(14,2) not null default 0,
  margen numeric(14,2) not null default 0,
  base_imponible numeric(14,2) not null default 0,
  iva numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  emitido_por uuid not null default auth.uid(),
  emitido_at timestamptz not null default now(),
  constraint presupuesto_emisiones_version_check check (version > 0),
  constraint presupuesto_emisiones_secuencia_check check (numero_secuencial > 0),
  constraint presupuesto_emisiones_ejercicio_check check (ejercicio between 2020 and 2200),
  constraint presupuesto_emisiones_estado_check check (estado in ('emitido', 'aceptado', 'rechazado', 'anulado')),
  constraint presupuesto_emisiones_snapshot_check check (jsonb_typeof(snapshot) = 'object'),
  constraint presupuesto_emisiones_importes_check check (
    base_partidas >= 0 and gastos_generales >= 0 and margen >= 0
    and base_imponible >= 0 and iva >= 0 and total >= 0
  ),
  unique (visita_id, version),
  unique (ejercicio, numero_secuencial, version)
);

create index if not exists presupuesto_emisiones_lead_idx
  on public.presupuesto_emisiones (lead_id, emitido_at desc);

create index if not exists presupuesto_emisiones_visita_idx
  on public.presupuesto_emisiones (visita_id, version desc);

alter table public.presupuesto_emisiones enable row level security;

drop policy if exists presupuesto_emisiones_lectura on public.presupuesto_emisiones;
create policy presupuesto_emisiones_lectura on public.presupuesto_emisiones
for select to authenticated
using (public.puede_gestionar_visita_presupuesto(lead_id));

grant select on public.presupuesto_emisiones to authenticated;
grant select, insert, update, delete on public.presupuesto_emisiones to service_role;

create or replace function public.emitir_presupuesto_visita(
  p_visita_id uuid,
  p_snapshot jsonb,
  p_importes jsonb
)
returns public.presupuesto_emisiones
language plpgsql
security definer
set search_path = public
as $$
declare
  v_visita public.visitas_presupuesto%rowtype;
  v_anterior public.presupuesto_emisiones%rowtype;
  v_resultado public.presupuesto_emisiones%rowtype;
  v_ejercicio integer := extract(year from current_date)::integer;
  v_secuencia integer;
  v_version integer;
  v_numero text;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para emitir un presupuesto.';
  end if;

  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' then
    raise exception 'La fotografía del presupuesto no es válida.';
  end if;

  select * into v_visita
  from public.visitas_presupuesto
  where id = p_visita_id;

  if not found then
    raise exception 'No se encontró el borrador de presupuesto.';
  end if;

  if not public.puede_gestionar_visita_presupuesto(v_visita.lead_id) then
    raise exception 'No tienes permiso para emitir este presupuesto.';
  end if;

  perform pg_advisory_xact_lock(hashtext('presupuesto-emisiones-' || v_ejercicio::text));

  select * into v_anterior
  from public.presupuesto_emisiones
  where visita_id = p_visita_id
  order by version desc
  limit 1;

  if found then
    v_ejercicio := v_anterior.ejercicio;
    v_secuencia := v_anterior.numero_secuencial;
    v_numero := v_anterior.numero;
    v_version := v_anterior.version + 1;
  else
    select coalesce(max(numero_secuencial), 0) + 1
      into v_secuencia
    from public.presupuesto_emisiones
    where ejercicio = v_ejercicio;

    v_numero := format('PRE-%s-%s', v_ejercicio, lpad(v_secuencia::text, 4, '0'));
    v_version := 1;
  end if;

  insert into public.presupuesto_emisiones (
    visita_id,
    lead_id,
    ejercicio,
    numero_secuencial,
    numero,
    version,
    snapshot,
    base_partidas,
    gastos_generales,
    margen,
    base_imponible,
    iva,
    total,
    emitido_por
  ) values (
    p_visita_id,
    v_visita.lead_id,
    v_ejercicio,
    v_secuencia,
    v_numero,
    v_version,
    p_snapshot,
    greatest(0, coalesce((p_importes ->> 'base_partidas')::numeric, 0)),
    greatest(0, coalesce((p_importes ->> 'gastos_generales')::numeric, 0)),
    greatest(0, coalesce((p_importes ->> 'margen')::numeric, 0)),
    greatest(0, coalesce((p_importes ->> 'base_imponible')::numeric, 0)),
    greatest(0, coalesce((p_importes ->> 'iva')::numeric, 0)),
    greatest(0, coalesce((p_importes ->> 'total')::numeric, 0)),
    auth.uid()
  )
  returning * into v_resultado;

  return v_resultado;
end;
$$;

revoke all on function public.emitir_presupuesto_visita(uuid, jsonb, jsonb) from public;
grant execute on function public.emitir_presupuesto_visita(uuid, jsonb, jsonb) to authenticated, service_role;

comment on table public.presupuesto_emisiones is
  'Fotografías inmutables y numeradas de los presupuestos emitidos desde una visita comercial.';

