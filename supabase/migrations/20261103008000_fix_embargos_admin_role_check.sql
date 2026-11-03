-- La sesión de Supabase usa el rol técnico authenticated.
-- El permiso de administrador del ERP se resuelve mediante app_current_role().
create or replace function public.api_crear_embargo_v2(
  empleado uuid,
  organismo text,
  motivo text,
  importe_total numeric,
  numero_cuotas integer,
  importe_cuota numeric
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  nuevo_id uuid;
begin
  if coalesce(public.app_current_role(), '') <> 'admin' then
    raise exception 'Solo un administrador puede crear embargos.' using errcode = '42501';
  end if;

  if empleado is null
     or nullif(trim(organismo), '') is null
     or importe_total is null or importe_total <= 0
     or numero_cuotas is null or numero_cuotas <= 0
     or importe_cuota is null or importe_cuota <= 0 then
    raise exception 'El plan de cuotas del embargo no es válido.' using errcode = '22023';
  end if;

  insert into public.embargos(
    empleado_id, organismo, motivo, importe_total, importe_pendiente,
    numero_cuotas, importe_cuota, estado, fecha_inicio, created_at, created_by
  ) values (
    empleado, trim(organismo), nullif(trim(motivo), ''), importe_total,
    importe_total, numero_cuotas, importe_cuota, 'activo', current_date, now(), auth.uid()
  ) returning id into nuevo_id;

  return nuevo_id;
end;
$fn$;
