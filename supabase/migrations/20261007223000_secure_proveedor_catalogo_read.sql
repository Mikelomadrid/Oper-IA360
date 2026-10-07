-- Lectura segura del catalogo de un proveedor para el ERP.
-- No se concede SELECT directo sobre la vista ni sobre sus tablas base.

create or replace function public.api_proveedor_catalogo_productos_v1(
  p_proveedor_id uuid
)
returns table (
  producto_id uuid,
  proveedor_id uuid,
  proveedor_nombre text,
  proveedor_cif text,
  referencia text,
  nombre text,
  categoria text,
  ultimo_precio numeric,
  veces_comprado integer,
  ultima_compra date,
  created_at timestamptz,
  updated_at timestamptz,
  compras_registradas integer,
  primera_compra_origen date,
  ultima_compra_origen date,
  total_comprado numeric,
  cantidad_total numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_proveedor_id is null then
    raise exception 'El proveedor es obligatorio';
  end if;

  if not public.app_is_admin_or_encargado() then
    raise exception 'Sin permisos para consultar el catalogo de proveedores';
  end if;

  if not exists (
    select 1
    from public.proveedores p
    where p.id = p_proveedor_id
  ) then
    raise exception 'Proveedor no encontrado';
  end if;

  return query
  select
    v.producto_id,
    v.proveedor_id,
    v.proveedor_nombre,
    v.proveedor_cif,
    v.referencia,
    v.nombre,
    v.categoria,
    v.ultimo_precio,
    v.veces_comprado,
    v.ultima_compra,
    v.created_at,
    v.updated_at,
    v.compras_registradas,
    v.primera_compra_origen,
    v.ultima_compra_origen,
    v.total_comprado,
    v.cantidad_total
  from public.v_proveedor_catalogo_productos v
  where v.proveedor_id = p_proveedor_id
  order by v.ultima_compra desc nulls last, v.nombre asc;
end;
$$;

revoke all on function public.api_proveedor_catalogo_productos_v1(uuid) from public;
grant execute on function public.api_proveedor_catalogo_productos_v1(uuid) to authenticated;

comment on function public.api_proveedor_catalogo_productos_v1(uuid) is
  'Devuelve el catalogo de un proveedor concreto solo a administradores y encargados.';
