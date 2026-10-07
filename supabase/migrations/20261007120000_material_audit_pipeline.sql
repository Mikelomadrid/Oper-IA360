-- IA360 · Auditoría de materiales por obra
-- Entorno objetivo inicial: Supabase de desarrollo.
-- Esta migración es aditiva: no elimina ni renombra objetos existentes.

begin;

-- Unificamos el catálogo OCR actual con el catálogo maestro ya existente.
alter table public.catalogo_proveedor_productos
  add column if not exists producto_maestro_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'catalogo_proveedor_productos_producto_maestro_id_fkey'
  ) then
    alter table public.catalogo_proveedor_productos
      add constraint catalogo_proveedor_productos_producto_maestro_id_fkey
      foreign key (producto_maestro_id)
      references public.productos_maestros(id)
      on delete set null;
  end if;
end $$;

-- Desglose de materiales que se espera consumir en una obra.
-- Puede proceder de una partida de presupuesto, de Contasimple o de revisión manual.
create table if not exists public.obra_materiales_previstos (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.proyectos(id) on delete cascade,
  partida_presupuesto_id uuid references public.obras_partidas(id) on delete set null,
  producto_maestro_id uuid references public.productos_maestros(id) on delete set null,
  producto_catalogo_id uuid references public.catalogo_proveedor_productos(id) on delete set null,
  descripcion text not null,
  referencia text,
  unidad text not null default 'ud',
  cantidad_prevista numeric(14,3) not null default 0,
  precio_unitario_previsto numeric(14,4) not null default 0,
  coste_previsto numeric(14,2) generated always as
    (round(cantidad_prevista * precio_unitario_previsto, 2)) stored,
  origen text not null default 'manual',
  estado text not null default 'pendiente_revision',
  confianza numeric(5,4),
  confirmado_por uuid references public.empleados(id) on delete set null,
  confirmado_at timestamptz,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint obra_materiales_previstos_origen_chk
    check (origen in ('manual', 'presupuesto_ocr', 'contasimple', 'importacion')),
  constraint obra_materiales_previstos_estado_chk
    check (estado in ('pendiente_revision', 'confirmado', 'descartado')),
  constraint obra_materiales_previstos_cantidad_chk
    check (cantidad_prevista >= 0),
  constraint obra_materiales_previstos_precio_chk
    check (precio_unitario_previsto >= 0),
  constraint obra_materiales_previstos_confianza_chk
    check (confianza is null or (confianza >= 0 and confianza <= 1))
);

create index if not exists idx_obra_materiales_previstos_obra
  on public.obra_materiales_previstos (obra_id, activo, estado);
create index if not exists idx_obra_materiales_previstos_catalogo
  on public.obra_materiales_previstos (producto_catalogo_id)
  where producto_catalogo_id is not null;
create index if not exists idx_obra_materiales_previstos_maestro
  on public.obra_materiales_previstos (producto_maestro_id)
  where producto_maestro_id is not null;

-- Trazabilidad de cada consumo real hasta la línea OCR que lo originó.
alter table public.partidas_gasto
  add column if not exists unidad text,
  add column if not exists linea_ocr_id uuid,
  add column if not exists producto_catalogo_id uuid,
  add column if not exists material_previsto_id uuid,
  add column if not exists estado_auditoria text not null default 'pendiente_revision',
  add column if not exists confianza_conciliacion numeric(5,4),
  add column if not exists motivo_auditoria text,
  add column if not exists actualizado_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'partidas_gasto_linea_ocr_id_fkey') then
    alter table public.partidas_gasto
      add constraint partidas_gasto_linea_ocr_id_fkey
      foreign key (linea_ocr_id)
      references public.facturas_gastos_lineas_ocr(id)
      on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'partidas_gasto_producto_catalogo_id_fkey') then
    alter table public.partidas_gasto
      add constraint partidas_gasto_producto_catalogo_id_fkey
      foreign key (producto_catalogo_id)
      references public.catalogo_proveedor_productos(id)
      on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'partidas_gasto_material_previsto_id_fkey') then
    alter table public.partidas_gasto
      add constraint partidas_gasto_material_previsto_id_fkey
      foreign key (material_previsto_id)
      references public.obra_materiales_previstos(id)
      on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'partidas_gasto_estado_auditoria_chk') then
    alter table public.partidas_gasto
      add constraint partidas_gasto_estado_auditoria_chk
      check (estado_auditoria in (
        'conciliado', 'no_previsto', 'unidad_incompatible',
        'exceso_cantidad', 'pendiente_revision', 'descartado'
      ));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'partidas_gasto_confianza_conciliacion_chk') then
    alter table public.partidas_gasto
      add constraint partidas_gasto_confianza_conciliacion_chk
      check (
        confianza_conciliacion is null
        or (confianza_conciliacion >= 0 and confianza_conciliacion <= 1)
      );
  end if;
end $$;

create unique index if not exists uq_partidas_gasto_linea_ocr
  on public.partidas_gasto (linea_ocr_id)
  where linea_ocr_id is not null;
create index if not exists idx_partidas_gasto_material_previsto
  on public.partidas_gasto (material_previsto_id)
  where material_previsto_id is not null;
create index if not exists idx_partidas_gasto_auditoria
  on public.partidas_gasto (proyecto_id, estado_auditoria);

create or replace function public.ia360_normalizar_unidad(p_unidad text)
returns text
language sql
immutable
parallel safe
as $$
  select case lower(trim(coalesce(p_unidad, '')))
    when '' then 'ud'
    when 'u' then 'ud'
    when 'uds' then 'ud'
    when 'unidad' then 'ud'
    when 'unidades' then 'ud'
    when 'pieza' then 'ud'
    when 'piezas' then 'ud'
    when 'metro' then 'm'
    when 'metros' then 'm'
    when 'ml' then 'm'
    when 'm.l.' then 'm'
    when 'm2' then 'm2'
    when 'm²' then 'm2'
    when 'metro cuadrado' then 'm2'
    when 'metros cuadrados' then 'm2'
    when 'm3' then 'm3'
    when 'm³' then 'm3'
    when 'kg.' then 'kg'
    when 'kilo' then 'kg'
    when 'kilos' then 'kg'
    when 'litro' then 'l'
    when 'litros' then 'l'
    else lower(trim(p_unidad))
  end;
$$;

-- Contabiliza en el ERP las líneas validadas de una factura de materiales.
-- Es idempotente: reintentar la misma factura actualiza, no duplica.
-- El envío externo a Contasimple se realiza en una Edge Function independiente.
create or replace function public.ia360_contabilizar_factura_materiales_erp(
  p_factura_id uuid,
  p_usuario_id uuid,
  p_estado_pago text default 'pendiente_pago'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_factura public.facturas_gastos%rowtype;
  v_linea record;
  v_gasto_result jsonb;
  v_gasto_id uuid;
  v_catalogo_result jsonb;
  v_producto_catalogo_id uuid;
  v_producto_maestro_id uuid;
  v_previsto public.obra_materiales_previstos%rowtype;
  v_unidad text;
  v_precio numeric;
  v_iva_ratio numeric;
  v_estado text;
  v_motivo text;
  v_procesadas integer := 0;
  v_conciliadas integer := 0;
  v_no_previstas integer := 0;
  v_unidades_incompatibles integer := 0;
begin
  if p_factura_id is null or p_usuario_id is null then
    raise exception 'factura_id y usuario_id son obligatorios';
  end if;

  -- Usuarios de la aplicación: solo administración o encargado.
  if auth.uid() is not null and not exists (
    select 1
    from public.empleados e
    where e.auth_user_id = auth.uid()
      and e.id = p_usuario_id
      and e.rol in ('admin'::public.app_role, 'encargado'::public.app_role)
  ) then
    raise exception 'sin permisos para contabilizar materiales';
  end if;

  select * into v_factura
  from public.facturas_gastos
  where id = p_factura_id
  for update;

  if not found then
    raise exception 'factura no encontrada: %', p_factura_id;
  end if;

  if v_factura.asignacion_tipo <> 'obra' or v_factura.obra_id is null then
    raise exception 'la factura de materiales debe estar asignada a una obra';
  end if;

  if exists (
    select 1
    from public.facturas_gastos_lineas_ocr l
    where l.factura_id = p_factura_id
      and l.es_material = true
      and l.validacion_estado <> 'validada'
  ) then
    raise exception 'hay líneas de material pendientes de validar';
  end if;

  if not exists (
    select 1
    from public.facturas_gastos_lineas_ocr l
    where l.factura_id = p_factura_id
      and l.es_material = true
      and l.validacion_estado = 'validada'
  ) then
    raise exception 'la factura no contiene líneas de material validadas';
  end if;

  v_gasto_result := public.flopy_contabilizar_factura_gasto_en_gastos(
    p_factura_id,
    p_usuario_id,
    p_estado_pago,
    'Unidades de material contabilizadas por IA360'
  );
  v_gasto_id := (v_gasto_result->>'gasto_id')::uuid;

  for v_linea in
    select l.*
    from public.facturas_gastos_lineas_ocr l
    where l.factura_id = p_factura_id
      and l.es_material = true
      and l.validacion_estado = 'validada'
    order by l.numero_linea nulls last, l.created_at
  loop
    v_procesadas := v_procesadas + 1;
    v_producto_catalogo_id := null;
    v_producto_maestro_id := null;
    -- La función existente comprueba proveedor + referencia y crea/actualiza
    -- el producto con el último precio. Sin referencia deja revisión manual.
    v_catalogo_result := public.flopy_alimentar_catalogo_desde_linea(v_linea.id);
    if coalesce((v_catalogo_result->>'ok')::boolean, false) then
      v_producto_catalogo_id := nullif(v_catalogo_result->>'producto_id', '')::uuid;
    end if;

    if v_producto_catalogo_id is not null then
      select producto_maestro_id into v_producto_maestro_id
      from public.catalogo_proveedor_productos
      where id = v_producto_catalogo_id;
    end if;

    v_unidad := public.ia360_normalizar_unidad(v_linea.unidad);
    v_precio := coalesce(
      v_linea.precio_unitario,
      case when coalesce(v_linea.cantidad, 0) <> 0
        then v_linea.base_linea / v_linea.cantidad
      end,
      0
    );
    v_iva_ratio := case
      when coalesce(v_linea.iva_porcentaje, 0) > 1
        then v_linea.iva_porcentaje / 100
      else coalesce(v_linea.iva_porcentaje, 0)
    end;

    -- Coincidencia segura: catálogo exacto, maestro exacto o descripción + unidad.
    select mp.* into v_previsto
    from public.obra_materiales_previstos mp
    where mp.obra_id = v_factura.obra_id
      and mp.activo = true
      and mp.estado = 'confirmado'
      and (
        (v_producto_catalogo_id is not null and mp.producto_catalogo_id = v_producto_catalogo_id)
        or (v_producto_maestro_id is not null and mp.producto_maestro_id = v_producto_maestro_id)
        or (
          lower(regexp_replace(trim(mp.descripcion), '\s+', ' ', 'g')) =
          lower(regexp_replace(trim(v_linea.descripcion), '\s+', ' ', 'g'))
          and public.ia360_normalizar_unidad(mp.unidad) = v_unidad
        )
      )
    order by
      (mp.producto_catalogo_id = v_producto_catalogo_id) desc nulls last,
      (mp.producto_maestro_id = v_producto_maestro_id) desc nulls last,
      mp.created_at
    limit 1;

    if v_previsto.id is null then
      v_estado := 'no_previsto';
      v_motivo := case
        when v_producto_catalogo_id is null
          then 'Producto sin referencia fiable o pendiente de alta/revisión en catálogo'
        else 'Producto del proveedor no incluido entre los materiales previstos de la obra'
      end;
      v_no_previstas := v_no_previstas + 1;
    elsif public.ia360_normalizar_unidad(v_previsto.unidad) <> v_unidad then
      v_estado := 'unidad_incompatible';
      v_motivo := format(
        'Unidad facturada %s; unidad prevista %s',
        coalesce(v_linea.unidad, 'sin unidad'),
        v_previsto.unidad
      );
      v_unidades_incompatibles := v_unidades_incompatibles + 1;
    else
      v_estado := 'conciliado';
      v_motivo := 'Coincidencia exacta con material previsto';
      v_conciliadas := v_conciliadas + 1;
    end if;

    insert into public.partidas_gasto (
      gasto_id,
      proyecto_id,
      descripcion_linea,
      referencia_proveedor,
      cantidad,
      unidad,
      precio_unidad,
      iva,
      producto_maestro_id,
      producto_catalogo_id,
      material_previsto_id,
      linea_ocr_id,
      estado_auditoria,
      confianza_conciliacion,
      motivo_auditoria,
      fecha_creacion,
      actualizado_at
    ) values (
      v_gasto_id,
      v_factura.obra_id,
      v_linea.descripcion,
      left(v_linea.referencia, 50),
      coalesce(v_linea.cantidad, 1),
      v_unidad,
      v_precio,
      v_iva_ratio,
      v_producto_maestro_id,
      v_producto_catalogo_id,
      v_previsto.id,
      v_linea.id,
      v_estado,
      case when v_estado = 'conciliado' then 1 else null end,
      v_motivo,
      now(),
      now()
    )
    on conflict (linea_ocr_id) where linea_ocr_id is not null
    do update set
      gasto_id = excluded.gasto_id,
      proyecto_id = excluded.proyecto_id,
      descripcion_linea = excluded.descripcion_linea,
      referencia_proveedor = excluded.referencia_proveedor,
      cantidad = excluded.cantidad,
      unidad = excluded.unidad,
      precio_unidad = excluded.precio_unidad,
      iva = excluded.iva,
      producto_maestro_id = excluded.producto_maestro_id,
      producto_catalogo_id = excluded.producto_catalogo_id,
      material_previsto_id = excluded.material_previsto_id,
      estado_auditoria = excluded.estado_auditoria,
      confianza_conciliacion = excluded.confianza_conciliacion,
      motivo_auditoria = excluded.motivo_auditoria,
      actualizado_at = now();
  end loop;

  return jsonb_build_object(
    'ok', true,
    'factura_id', p_factura_id,
    'gasto_id', v_gasto_id,
    'obra_id', v_factura.obra_id,
    'lineas_procesadas', v_procesadas,
    'conciliadas', v_conciliadas,
    'no_previstas', v_no_previstas,
    'unidades_incompatibles', v_unidades_incompatibles,
    'contasimple', 'pendiente_de_envio_externo'
  );
end;
$$;

create or replace view public.v_obra_materiales_control
with (security_invoker = true) as
with reales as (
  select
    pg.proyecto_id as obra_id,
    pg.material_previsto_id,
    pg.producto_maestro_id,
    pg.producto_catalogo_id,
    pg.descripcion_linea,
    coalesce(pg.unidad, 'ud') as unidad,
    sum(pg.cantidad) as cantidad_real,
    sum(pg.subtotal) as coste_real,
    count(distinct pg.gasto_id)::integer as facturas,
    bool_or(pg.estado_auditoria = 'unidad_incompatible') as unidad_incompatible
  from public.partidas_gasto pg
  where pg.linea_ocr_id is not null
    and pg.estado_auditoria <> 'descartado'
  group by
    pg.proyecto_id, pg.material_previsto_id, pg.producto_maestro_id,
    pg.producto_catalogo_id, pg.descripcion_linea, coalesce(pg.unidad, 'ud')
), previstos as (
  select
    mp.obra_id,
    mp.id as material_previsto_id,
    mp.producto_maestro_id,
    mp.producto_catalogo_id,
    mp.descripcion,
    mp.unidad,
    mp.cantidad_prevista,
    mp.precio_unitario_previsto,
    mp.coste_previsto
  from public.obra_materiales_previstos mp
  where mp.activo = true and mp.estado = 'confirmado'
)
select
  p.id as obra_id,
  p.nombre_proyecto,
  pr.material_previsto_id,
  pr.producto_maestro_id,
  pr.producto_catalogo_id,
  pr.descripcion,
  pr.unidad,
  pr.cantidad_prevista,
  coalesce(sum(r.cantidad_real), 0) as cantidad_real,
  coalesce(sum(r.cantidad_real), 0) - pr.cantidad_prevista as desviacion_cantidad,
  pr.precio_unitario_previsto,
  pr.coste_previsto,
  coalesce(sum(r.coste_real), 0) as coste_real,
  coalesce(sum(r.coste_real), 0) - pr.coste_previsto as desviacion_coste,
  coalesce(sum(r.facturas), 0)::integer as facturas,
  case
    when bool_or(coalesce(r.unidad_incompatible, false)) then 'unidad_incompatible'
    when coalesce(sum(r.cantidad_real), 0) > pr.cantidad_prevista then 'exceso_cantidad'
    when coalesce(sum(r.coste_real), 0) > pr.coste_previsto then 'exceso_coste'
    else 'dentro_prevision'
  end as estado_auditoria
from previstos pr
join public.proyectos p on p.id = pr.obra_id
left join reales r on r.material_previsto_id = pr.material_previsto_id
group by
  p.id, p.nombre_proyecto, pr.material_previsto_id, pr.producto_maestro_id,
  pr.producto_catalogo_id, pr.descripcion, pr.unidad, pr.cantidad_prevista,
  pr.precio_unitario_previsto, pr.coste_previsto
union all
select
  p.id as obra_id,
  p.nombre_proyecto,
  null::uuid as material_previsto_id,
  r.producto_maestro_id,
  r.producto_catalogo_id,
  r.descripcion_linea as descripcion,
  r.unidad,
  0::numeric as cantidad_prevista,
  sum(r.cantidad_real) as cantidad_real,
  sum(r.cantidad_real) as desviacion_cantidad,
  0::numeric as precio_unitario_previsto,
  0::numeric as coste_previsto,
  sum(r.coste_real) as coste_real,
  sum(r.coste_real) as desviacion_coste,
  sum(r.facturas)::integer as facturas,
  case when bool_or(r.unidad_incompatible) then 'unidad_incompatible' else 'no_previsto' end
    as estado_auditoria
from reales r
join public.proyectos p on p.id = r.obra_id
where r.material_previsto_id is null
group by
  p.id, p.nombre_proyecto, r.producto_maestro_id, r.producto_catalogo_id,
  r.descripcion_linea, r.unidad;

create or replace view public.v_factura_material_auditoria
with (security_invoker = true) as
select
  fg.id as factura_id,
  fg.obra_id,
  p.nombre_proyecto,
  fg.proveedor_id,
  pr.nombre as proveedor_nombre,
  ocr.numero_factura,
  ocr.fecha_factura,
  l.id as linea_ocr_id,
  l.numero_linea,
  l.referencia,
  l.descripcion,
  l.cantidad,
  l.unidad,
  l.precio_unitario,
  l.base_linea,
  l.total_linea,
  l.validacion_estado,
  pg.id as partida_gasto_id,
  pg.producto_catalogo_id,
  pg.producto_maestro_id,
  pg.material_previsto_id,
  pg.estado_auditoria,
  pg.motivo_auditoria,
  pg.confianza_conciliacion
from public.facturas_gastos fg
left join lateral (
  select o.* from public.facturas_gastos_ocr o
  where o.factura_id = fg.id
  order by o.created_at desc limit 1
) ocr on true
join public.facturas_gastos_lineas_ocr l on l.factura_id = fg.id and l.es_material = true
left join public.partidas_gasto pg on pg.linea_ocr_id = l.id
left join public.proyectos p on p.id = fg.obra_id
left join public.proveedores pr on pr.id = fg.proveedor_id;

alter table public.obra_materiales_previstos enable row level security;

drop policy if exists obra_materiales_previstos_gestion on public.obra_materiales_previstos;
create policy obra_materiales_previstos_gestion
on public.obra_materiales_previstos
to authenticated
using (
  exists (
    select 1 from public.empleados e
    where e.auth_user_id = auth.uid()
      and e.rol in ('admin'::public.app_role, 'encargado'::public.app_role)
  )
)
with check (
  exists (
    select 1 from public.empleados e
    where e.auth_user_id = auth.uid()
      and e.rol in ('admin'::public.app_role, 'encargado'::public.app_role)
  )
);

drop policy if exists obra_materiales_previstos_tecnico_lectura on public.obra_materiales_previstos;
create policy obra_materiales_previstos_tecnico_lectura
on public.obra_materiales_previstos
for select
to authenticated
using (
  exists (
    select 1
    from public.empleados e
    join public.proyectos_empleados pe on pe.empleado_id = e.id
    where e.auth_user_id = auth.uid()
      and pe.proyecto_id = obra_materiales_previstos.obra_id
  )
);

revoke all on function public.ia360_contabilizar_factura_materiales_erp(uuid, uuid, text) from public, anon;
grant execute on function public.ia360_contabilizar_factura_materiales_erp(uuid, uuid, text) to authenticated, service_role;
grant select on public.v_obra_materiales_control to authenticated, service_role;
grant select on public.v_factura_material_auditoria to authenticated, service_role;
grant select, insert, update, delete on public.obra_materiales_previstos to authenticated, service_role;

comment on table public.obra_materiales_previstos is
  'Materiales y cantidades previstos por obra para comparar presupuesto frente a consumo real.';
comment on function public.ia360_contabilizar_factura_materiales_erp(uuid, uuid, text) is
  'Contabiliza de forma idempotente líneas OCR validadas: gasto ERP, catálogo de proveedor y unidades por obra.';
comment on view public.v_obra_materiales_control is
  'Comparación de cantidades y costes previstos frente a materiales facturados por obra.';

commit;
