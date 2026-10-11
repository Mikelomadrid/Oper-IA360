-- Circuito comercial trazable para presupuestos emitidos.
-- La fotografia (snapshot) sigue siendo inmutable; solo cambia el estado
-- comercial de la version y cada cambio queda registrado como evento.

alter table public.presupuesto_emisiones
  add column if not exists enviado_at timestamptz,
  add column if not exists respondido_at timestamptz,
  add column if not exists respuesta_notas text,
  add column if not exists proyecto_id uuid references public.proyectos(id) on delete set null;

alter table public.presupuesto_emisiones
  drop constraint if exists presupuesto_emisiones_estado_check;

alter table public.presupuesto_emisiones
  add constraint presupuesto_emisiones_estado_check
  check (estado in ('emitido', 'enviado', 'aceptado', 'cambios_solicitados', 'rechazado', 'anulado'));

create unique index if not exists presupuesto_emisiones_proyecto_uniq
  on public.presupuesto_emisiones (proyecto_id)
  where proyecto_id is not null;

create table if not exists public.presupuesto_emision_eventos (
  id uuid primary key default gen_random_uuid(),
  emision_id uuid not null references public.presupuesto_emisiones(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete restrict,
  tipo text not null,
  detalle text,
  creado_por uuid not null default auth.uid(),
  creado_at timestamptz not null default now(),
  constraint presupuesto_emision_eventos_tipo_check
    check (tipo in ('emitido', 'enviado', 'aceptado', 'cambios_solicitados', 'rechazado', 'anulado', 'convertido_obra'))
);

create index if not exists presupuesto_emision_eventos_emision_idx
  on public.presupuesto_emision_eventos (emision_id, creado_at desc);

alter table public.presupuesto_emision_eventos enable row level security;

drop policy if exists presupuesto_emision_eventos_lectura on public.presupuesto_emision_eventos;
create policy presupuesto_emision_eventos_lectura on public.presupuesto_emision_eventos
for select to authenticated
using (public.puede_gestionar_visita_presupuesto(lead_id));

grant select on public.presupuesto_emision_eventos to authenticated;
grant select, insert, update, delete on public.presupuesto_emision_eventos to service_role;

insert into public.presupuesto_emision_eventos (emision_id, lead_id, tipo, detalle, creado_por, creado_at)
select pe.id, pe.lead_id, 'emitido', 'Versión emitida', pe.emitido_por, pe.emitido_at
from public.presupuesto_emisiones pe
where not exists (
  select 1
  from public.presupuesto_emision_eventos evento
  where evento.emision_id = pe.id and evento.tipo = 'emitido'
);

create or replace function public.registrar_evento_nueva_emision_presupuesto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.presupuesto_emision_eventos (
    emision_id,
    lead_id,
    tipo,
    detalle,
    creado_por,
    creado_at
  ) values (
    new.id,
    new.lead_id,
    'emitido',
    'Versión emitida',
    new.emitido_por,
    new.emitido_at
  );
  return new;
end;
$$;

drop trigger if exists presupuesto_emision_registrar_evento on public.presupuesto_emisiones;
create trigger presupuesto_emision_registrar_evento
after insert on public.presupuesto_emisiones
for each row execute function public.registrar_evento_nueva_emision_presupuesto();

alter table public.obras_partidas
  add column if not exists presupuesto_emision_id uuid references public.presupuesto_emisiones(id) on delete set null,
  add column if not exists sistema_id uuid references public.sistemas_rendimiento(id) on delete set null,
  add column if not exists capitulo text,
  add column if not exists zona text,
  add column if not exists fase_ejecucion text,
  add column if not exists desglose_precio jsonb not null default '[]'::jsonb;

create unique index if not exists obras_partidas_emision_orden_uniq
  on public.obras_partidas (presupuesto_emision_id, orden)
  where presupuesto_emision_id is not null;

create or replace function public.registrar_estado_presupuesto(
  p_emision_id uuid,
  p_estado text,
  p_observaciones text default null
)
returns public.presupuesto_emisiones
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emision public.presupuesto_emisiones%rowtype;
  v_resultado public.presupuesto_emisiones%rowtype;
  v_estado text := lower(btrim(coalesce(p_estado, '')));
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para actualizar el presupuesto.';
  end if;

  select * into v_emision
  from public.presupuesto_emisiones
  where id = p_emision_id
  for update;

  if not found then
    raise exception 'No se encontró la versión del presupuesto.';
  end if;

  if not public.puede_gestionar_visita_presupuesto(v_emision.lead_id) then
    raise exception 'No tienes permiso para gestionar este presupuesto.';
  end if;

  if v_estado not in ('enviado', 'aceptado', 'cambios_solicitados', 'rechazado', 'anulado') then
    raise exception 'Estado comercial no válido: %', v_estado;
  end if;

  if v_emision.estado in ('aceptado', 'rechazado', 'anulado') then
    raise exception 'La versión ya está cerrada con estado %.', v_emision.estado;
  end if;

  if v_emision.estado = 'cambios_solicitados' then
    raise exception 'Esta versión tiene cambios solicitados. Edita el borrador y emite una versión nueva.';
  end if;

  if v_estado = v_emision.estado then
    return v_emision;
  end if;

  update public.presupuesto_emisiones
  set estado = v_estado,
      enviado_at = case when v_estado = 'enviado' then coalesce(enviado_at, now()) else enviado_at end,
      respondido_at = case when v_estado in ('aceptado', 'cambios_solicitados', 'rechazado') then now() else respondido_at end,
      respuesta_notas = case
        when v_estado in ('aceptado', 'cambios_solicitados', 'rechazado') then nullif(btrim(p_observaciones), '')
        else respuesta_notas
      end
  where id = p_emision_id
  returning * into v_resultado;

  insert into public.presupuesto_emision_eventos (emision_id, lead_id, tipo, detalle, creado_por)
  values (v_resultado.id, v_resultado.lead_id, v_estado, nullif(btrim(p_observaciones), ''), auth.uid());

  return v_resultado;
end;
$$;

revoke all on function public.registrar_estado_presupuesto(uuid, text, text) from public;
grant execute on function public.registrar_estado_presupuesto(uuid, text, text) to authenticated, service_role;

create or replace function public.convertir_presupuesto_aceptado_a_obra(
  p_emision_id uuid,
  p_descripcion text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emision public.presupuesto_emisiones%rowtype;
  v_conversion jsonb;
  v_proyecto_id uuid;
  v_descripcion text;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para crear la obra.';
  end if;

  select * into v_emision
  from public.presupuesto_emisiones
  where id = p_emision_id
  for update;

  if not found then
    raise exception 'No se encontró la versión del presupuesto.';
  end if;

  if not public.puede_gestionar_visita_presupuesto(v_emision.lead_id) then
    raise exception 'No tienes permiso para convertir este presupuesto.';
  end if;

  if v_emision.estado <> 'aceptado' then
    raise exception 'Solo se puede convertir en obra una versión aceptada.';
  end if;

  if v_emision.proyecto_id is not null then
    return jsonb_build_object(
      'success', true,
      'proyecto_id', v_emision.proyecto_id,
      'message', 'La obra ya estaba creada.'
    );
  end if;

  v_descripcion := coalesce(
    nullif(btrim(p_descripcion), ''),
    nullif(v_emision.snapshot #>> '{documento,objeto_presupuesto}', ''),
    nullif(v_emision.snapshot #>> '{documento,resumen}', '')
  );

  select public.approve_lead_to_proyecto_v2(v_emision.lead_id, v_descripcion, null)::jsonb
  into v_conversion;

  if coalesce((v_conversion ->> 'success')::boolean, false) is not true then
    raise exception '%', coalesce(v_conversion ->> 'error', 'No se pudo crear la obra.');
  end if;

  v_proyecto_id := (v_conversion ->> 'proyecto_id')::uuid;
  if v_proyecto_id is null then
    raise exception 'La conversión no devolvió el identificador de la obra.';
  end if;

  update public.proyectos
  set descripcion = coalesce(v_descripcion, descripcion),
      presupuesto_aceptado = v_emision.base_imponible,
      gastos_generales_estimados = v_emision.gastos_generales,
      objetivo_margen_pct = coalesce((v_emision.snapshot #>> '{ajustes_comerciales,margen_pct}')::numeric, objetivo_margen_pct)
  where id = v_proyecto_id;

  insert into public.obras_partidas (
    obra_id,
    codigo,
    descripcion,
    unidad,
    cantidad_total,
    precio_unitario,
    orden,
    activa,
    presupuesto_emision_id,
    sistema_id,
    capitulo,
    zona,
    fase_ejecucion,
    desglose_precio
  )
  select
    v_proyecto_id,
    nullif(partida.item ->> 'codigo', ''),
    coalesce(nullif(partida.item ->> 'descripcion', ''), 'Partida aceptada'),
    coalesce(nullif(partida.item ->> 'unidad', ''), 'ud'),
    greatest(0, coalesce((partida.item ->> 'cantidad')::numeric, 0)),
    case
      when jsonb_array_length(coalesce(partida.item -> 'desglose_precio', '[]'::jsonb)) > 0 then
        case
          when coalesce((partida.item ->> 'cantidad')::numeric, 0) > 0 then
            (
              select coalesce(sum(
                coalesce((componente ->> 'cantidad')::numeric, 0)
                * coalesce((componente ->> 'precio_unitario')::numeric, 0)
              ), 0)
              from jsonb_array_elements(coalesce(partida.item -> 'desglose_precio', '[]'::jsonb)) componente
            ) / (partida.item ->> 'cantidad')::numeric
          else 0
        end
      else coalesce((partida.item ->> 'precio_unitario')::numeric, 0)
    end,
    coalesce((partida.item ->> 'orden')::integer, partida.ordinality::integer - 1),
    true,
    v_emision.id,
    nullif(partida.item ->> 'sistema_id', '')::uuid,
    nullif(partida.item ->> 'capitulo', ''),
    nullif(partida.item ->> 'zona', ''),
    nullif(partida.item ->> 'fase_ejecucion', ''),
    coalesce(partida.item -> 'desglose_precio', '[]'::jsonb)
  from jsonb_array_elements(coalesce(v_emision.snapshot -> 'partidas', '[]'::jsonb))
    with ordinality as partida(item, ordinality);

  update public.presupuesto_emisiones
  set proyecto_id = v_proyecto_id
  where id = v_emision.id;

  insert into public.presupuesto_emision_eventos (emision_id, lead_id, tipo, detalle, creado_por)
  values (v_emision.id, v_emision.lead_id, 'convertido_obra', 'Presupuesto convertido en obra', auth.uid());

  return jsonb_build_object(
    'success', true,
    'proyecto_id', v_proyecto_id,
    'partidas_creadas', jsonb_array_length(coalesce(v_emision.snapshot -> 'partidas', '[]'::jsonb))
  );
end;
$$;

revoke all on function public.convertir_presupuesto_aceptado_a_obra(uuid, text) from public;
grant execute on function public.convertir_presupuesto_aceptado_a_obra(uuid, text) to authenticated, service_role;

comment on table public.presupuesto_emision_eventos is
  'Historial inmutable de los cambios comerciales de cada versión de presupuesto.';

