-- Corrige el buscador de proveedores cuando la extension unaccent no esta
-- instalada. La comparacion ILIKE conserva la busqueda sin distinguir
-- mayusculas/minusculas y evita que el listado completo falle al iniciar.

create or replace function public.api_proveedor_search_v2(
  p_q text default null::text,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table(
  id uuid,
  nombre text,
  cif text,
  email text,
  telefono text,
  contacto text,
  direccion text,
  cp text,
  ciudad text,
  provincia text,
  pais text,
  fecha_creacion timestamptz,
  activo boolean,
  created_by uuid
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select
    p.id,
    p.nombre,
    p.cif,
    p.email,
    p.telefono,
    p.contacto,
    p.direccion,
    p.cp,
    p.ciudad,
    p.provincia,
    p.pais,
    p.fecha_creacion,
    p.activo,
    p.created_by
  from public.proveedores p
  where
    nullif(btrim(p_q), '') is null
    or p.nombre ilike '%' || btrim(p_q) || '%'
    or p.cif ilike '%' || btrim(p_q) || '%'
  order by p.nombre asc
  limit greatest(p_limit, 0)
  offset greatest(p_offset, 0);
$function$;

