-- Unifica el control previsto/facturado con el reparto por líneas actual.
-- Las asignaciones creadas por el escáner ya son movimientos contables de
-- material y no deben volver a mostrarse como pendientes del flujo legado.

begin;

create or replace view public.v_obra_materiales_control
with (security_invoker = true) as
with reales_base as (
  -- Flujo actual: compras, salidas de almacén y devoluciones ya consolidadas
  -- por v_obra_materiales_balance. El abono vinculado no descuenta dos veces.
  select
    b.obra_id,
    null::uuid as producto_maestro_id,
    b.producto_catalogo_id,
    b.descripcion as descripcion_linea,
    coalesce(b.unidad, 'ud') as unidad,
    b.cantidad_neta as cantidad_real,
    b.coste_neto as coste_real,
    greatest(coalesce(b.movimientos, 0), 0)::integer as facturas,
    false as unidad_incompatible
  from public.v_obra_materiales_balance b

  union all

  -- Compatibilidad con datos históricos contabilizados antes del reparto por
  -- líneas. Si la línea ya tiene una asignación nueva, se excluye para impedir
  -- que ambos modelos sumen el mismo material.
  select
    pg.proyecto_id as obra_id,
    pg.producto_maestro_id,
    pg.producto_catalogo_id,
    pg.descripcion_linea,
    coalesce(pg.unidad, 'ud') as unidad,
    pg.cantidad as cantidad_real,
    pg.subtotal as coste_real,
    1::integer as facturas,
    pg.estado_auditoria = 'unidad_incompatible' as unidad_incompatible
  from public.partidas_gasto pg
  where pg.linea_ocr_id is not null
    and pg.estado_auditoria <> 'descartado'
    and not exists (
      select 1
      from public.factura_gasto_linea_asignaciones a
      where a.linea_ocr_id = pg.linea_ocr_id
    )
), reales_clasificados as (
  select
    r.*,
    coincidencia.material_previsto_id
  from reales_base r
  left join lateral (
    select mp.id as material_previsto_id
    from public.obra_materiales_previstos mp
    where mp.obra_id = r.obra_id
      and mp.activo = true
      and mp.estado = 'confirmado'
      and (
        (r.producto_catalogo_id is not null and mp.producto_catalogo_id = r.producto_catalogo_id)
        or (r.producto_maestro_id is not null and mp.producto_maestro_id = r.producto_maestro_id)
        or (
          lower(regexp_replace(trim(mp.descripcion), '\s+', ' ', 'g')) =
          lower(regexp_replace(trim(r.descripcion_linea), '\s+', ' ', 'g'))
          and public.ia360_normalizar_unidad(mp.unidad) = public.ia360_normalizar_unidad(r.unidad)
        )
      )
    order by
      (mp.producto_catalogo_id = r.producto_catalogo_id) desc nulls last,
      (mp.producto_maestro_id = r.producto_maestro_id) desc nulls last,
      mp.created_at
    limit 1
  ) coincidencia on true
), reales as (
  select
    obra_id,
    material_previsto_id,
    producto_maestro_id,
    producto_catalogo_id,
    descripcion_linea,
    unidad,
    sum(cantidad_real) as cantidad_real,
    sum(coste_real) as coste_real,
    sum(facturas)::integer as facturas,
    bool_or(unidad_incompatible) as unidad_incompatible
  from reales_clasificados
  group by
    obra_id, material_previsto_id, producto_maestro_id,
    producto_catalogo_id, descripcion_linea, unidad
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
  coalesce(a.obra_id, fg.obra_id) as obra_id,
  p.nombre_proyecto,
  fg.proveedor_id,
  pr.nombre as proveedor_nombre,
  ocr.numero_factura,
  ocr.fecha_factura,
  l.id as linea_ocr_id,
  l.numero_linea,
  l.referencia,
  l.descripcion,
  coalesce(a.cantidad, l.cantidad) as cantidad,
  coalesce(a.unidad, l.unidad) as unidad,
  coalesce(a.precio_unitario, l.precio_unitario) as precio_unitario,
  coalesce(a.importe_base, l.base_linea) as base_linea,
  l.total_linea,
  l.validacion_estado,
  coalesce(pg.id, a.id) as partida_gasto_id,
  coalesce(a.producto_catalogo_id, pg.producto_catalogo_id) as producto_catalogo_id,
  pg.producto_maestro_id,
  coalesce(a.material_previsto_id, pg.material_previsto_id) as material_previsto_id,
  coalesce(a.estado_auditoria, pg.estado_auditoria) as estado_auditoria,
  pg.motivo_auditoria,
  pg.confianza_conciliacion
from public.facturas_gastos fg
left join lateral (
  select o.*
  from public.facturas_gastos_ocr o
  where o.factura_id = fg.id
  order by o.created_at desc
  limit 1
) ocr on true
join public.facturas_gastos_lineas_ocr l
  on l.factura_id = fg.id and l.es_material = true
left join public.factura_gasto_linea_asignaciones a
  on a.linea_ocr_id = l.id and a.destino_tipo = 'obra'
left join public.partidas_gasto pg
  on pg.linea_ocr_id = l.id and a.id is null
left join public.proyectos p
  on p.id = coalesce(a.obra_id, fg.obra_id)
left join public.proveedores pr
  on pr.id = fg.proveedor_id;

grant select on public.v_obra_materiales_control to authenticated, service_role;
grant select on public.v_factura_material_auditoria to authenticated, service_role;

comment on view public.v_obra_materiales_control is
  'Compara lo previsto con el balance real del flujo distribuido y conserva partidas históricas no migradas, sin duplicarlas.';
comment on view public.v_factura_material_auditoria is
  'Expone líneas materiales e identifica como contabilizadas tanto las asignaciones actuales como las partidas históricas.';

commit;
