-- Las devoluciones, abonos y cualquier linea no positiva no son compras de
-- catalogo. Se conservan en la factura y en los movimientos de obra, pero no
-- deben crear productos ni aumentar cantidades/importes comprados al proveedor.

create or replace function public.flopy_alimentar_catalogo_desde_linea(
  p_linea_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_linea record;
  v_producto_id uuid;
  v_existing_origen uuid;
  v_ref text;
  v_nombre text;
  v_categoria text;
  v_precio numeric;
  v_importe numeric;
  v_fecha date;
begin
  if p_linea_id is null then
    raise exception 'linea_id obligatorio';
  end if;

  select
    l.*,
    fg.proveedor_id,
    fg.id as factura_id,
    ocr.fecha_factura,
    ocr.proveedor_nombre,
    ocr.proveedor_nif
  into v_linea
  from public.facturas_gastos_lineas_ocr l
  join public.facturas_gastos fg
    on fg.id = l.factura_id
  left join public.facturas_gastos_ocr ocr
    on ocr.id = l.ocr_id
  where l.id = p_linea_id;

  if not found then
    raise exception 'linea no encontrada: %', p_linea_id;
  end if;

  if v_linea.validacion_estado <> 'validada' then
    return jsonb_build_object(
      'ok', false,
      'linea_id', p_linea_id,
      'error', 'linea_no_validada',
      'estado_actual', v_linea.validacion_estado
    );
  end if;

  if coalesce(v_linea.es_material, false) is false then
    return jsonb_build_object(
      'ok', false,
      'linea_id', p_linea_id,
      'error', 'linea_no_material'
    );
  end if;

  v_importe := coalesce(
    v_linea.base_linea,
    v_linea.total_linea,
    v_linea.cantidad * v_linea.precio_unitario,
    0
  );

  if coalesce(v_linea.cantidad, 0) <= 0 or v_importe <= 0 then
    return jsonb_build_object(
      'ok', false,
      'linea_id', p_linea_id,
      'error', 'linea_no_compra_positiva',
      'cantidad', v_linea.cantidad,
      'importe', v_importe,
      'mensaje', 'Las devoluciones y lineas no positivas no alimentan el catalogo del proveedor'
    );
  end if;

  if v_linea.proveedor_id is null then
    return jsonb_build_object(
      'ok', false,
      'linea_id', p_linea_id,
      'error', 'factura_sin_proveedor_id',
      'proveedor_nombre_ocr', v_linea.proveedor_nombre,
      'proveedor_nif_ocr', v_linea.proveedor_nif
    );
  end if;

  v_ref := nullif(upper(trim(coalesce(v_linea.referencia, ''))), '');
  v_nombre := nullif(trim(coalesce(v_linea.descripcion, '')), '');
  v_categoria := nullif(trim(coalesce(v_linea.categoria, '')), '');
  v_precio := coalesce(v_linea.precio_unitario, v_linea.total_linea);
  v_fecha := coalesce(v_linea.fecha_factura, current_date);

  if v_ref is null then
    return jsonb_build_object(
      'ok', false,
      'linea_id', p_linea_id,
      'error', 'linea_sin_referencia',
      'mensaje', 'No se alimenta catalogo sin referencia de proveedor para evitar duplicados por descripcion'
    );
  end if;

  if v_nombre is null then
    return jsonb_build_object(
      'ok', false,
      'linea_id', p_linea_id,
      'error', 'linea_sin_descripcion'
    );
  end if;

  select id
  into v_existing_origen
  from public.catalogo_proveedor_productos_origenes
  where linea_ocr_id = p_linea_id
  limit 1;

  if v_existing_origen is not null then
    select producto_id
    into v_producto_id
    from public.catalogo_proveedor_productos_origenes
    where id = v_existing_origen;

    return jsonb_build_object(
      'ok', true,
      'linea_id', p_linea_id,
      'producto_id', v_producto_id,
      'already_fed', true,
      'mensaje', 'Esta linea ya habia alimentado el catalogo'
    );
  end if;

  select id
  into v_producto_id
  from public.catalogo_proveedor_productos
  where proveedor_id = v_linea.proveedor_id
    and upper(trim(coalesce(referencia, ''))) = v_ref
  limit 1;

  if v_producto_id is null then
    insert into public.catalogo_proveedor_productos (
      proveedor_id,
      referencia,
      nombre,
      categoria,
      ultimo_precio,
      veces_comprado,
      ultima_compra,
      created_at,
      updated_at
    )
    values (
      v_linea.proveedor_id,
      v_ref,
      v_nombre,
      v_categoria,
      v_precio,
      1,
      v_fecha,
      now(),
      now()
    )
    returning id into v_producto_id;
  else
    update public.catalogo_proveedor_productos
    set
      nombre = coalesce(v_nombre, nombre),
      categoria = coalesce(v_categoria, categoria),
      ultimo_precio = coalesce(v_precio, ultimo_precio),
      veces_comprado = coalesce(veces_comprado, 0) + 1,
      ultima_compra = greatest(coalesce(ultima_compra, v_fecha), v_fecha),
      updated_at = now()
    where id = v_producto_id;
  end if;

  insert into public.catalogo_proveedor_productos_origenes (
    producto_id,
    linea_ocr_id,
    factura_id,
    proveedor_id,
    referencia,
    descripcion,
    categoria,
    cantidad,
    unidad,
    precio_unitario,
    total_linea,
    fecha_factura
  )
  values (
    v_producto_id,
    p_linea_id,
    v_linea.factura_id,
    v_linea.proveedor_id,
    v_ref,
    v_nombre,
    v_categoria,
    v_linea.cantidad,
    v_linea.unidad,
    v_linea.precio_unitario,
    v_linea.total_linea,
    v_fecha
  );

  return jsonb_build_object(
    'ok', true,
    'linea_id', p_linea_id,
    'producto_id', v_producto_id,
    'already_fed', false,
    'proveedor_id', v_linea.proveedor_id,
    'referencia', v_ref,
    'nombre', v_nombre,
    'ultimo_precio', v_precio,
    'fecha', v_fecha
  );
end;
$$;

create or replace view public.v_proveedor_catalogo_productos as
with origenes_validos as (
  select
    o.producto_id,
    count(*)::integer as compras_registradas,
    min(o.fecha_factura) as primera_compra_origen,
    max(o.fecha_factura) as ultima_compra_origen,
    sum(coalesce(o.total_linea, 0::numeric)) as total_comprado,
    sum(coalesce(o.cantidad, 0::numeric)) as cantidad_total
  from public.catalogo_proveedor_productos_origenes o
  join public.facturas_gastos_lineas_ocr l
    on l.id = o.linea_ocr_id
  where coalesce(l.cantidad, 0) > 0
    and coalesce(l.base_linea, l.total_linea, 0) > 0
  group by o.producto_id
),
origenes_totales as (
  select
    o.producto_id,
    count(*)::integer as origenes_registrados
  from public.catalogo_proveedor_productos_origenes o
  group by o.producto_id
)
select
  c.id as producto_id,
  c.proveedor_id,
  p.nombre as proveedor_nombre,
  p.cif as proveedor_cif,
  c.referencia,
  c.nombre,
  c.categoria,
  c.ultimo_precio,
  c.veces_comprado,
  c.ultima_compra,
  c.created_at,
  c.updated_at,
  coalesce(o.compras_registradas, 0) as compras_registradas,
  o.primera_compra_origen,
  o.ultima_compra_origen,
  coalesce(o.total_comprado, 0::numeric) as total_comprado,
  coalesce(o.cantidad_total, 0::numeric) as cantidad_total
from public.catalogo_proveedor_productos c
left join public.proveedores p
  on p.id = c.proveedor_id
left join origenes_validos o
  on o.producto_id = c.id
left join origenes_totales ot
  on ot.producto_id = c.id
where o.producto_id is not null
   or coalesce(ot.origenes_registrados, 0) = 0;

comment on function public.flopy_alimentar_catalogo_desde_linea(uuid) is
  'Alimenta el catalogo solo con compras materiales validadas de cantidad e importe positivos.';

comment on view public.v_proveedor_catalogo_productos is
  'Catalogo de proveedor: excluye devoluciones, abonos y lineas no positivas de cantidades e importes comprados.';
