-- Embargos: solo el administrador puede crearlos y gestionarlos.
-- Cada empleado conserva lectura exclusivamente sobre sus propios registros.

create or replace function public.api_crear_embargo_v1(
  empleado uuid,
  organismo text,
  motivo text,
  importe_total numeric
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  nuevo_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede crear embargos.' using errcode = '42501';
  end if;

  if empleado is null or nullif(trim(organismo), '') is null or importe_total is null or importe_total <= 0 then
    raise exception 'Los datos del embargo no son válidos.' using errcode = '22023';
  end if;

  insert into public.embargos(
    empleado_id, organismo, motivo, importe_total, importe_pendiente,
    estado, fecha_inicio, created_at, created_by
  ) values (
    empleado, trim(organismo), nullif(trim(motivo), ''), importe_total,
    importe_total, 'activo', current_date, now(), auth.uid()
  ) returning id into nuevo_id;

  return nuevo_id;
end;
$$;

drop policy if exists "admin puede todo embargos" on public.embargos;
create policy "admin puede todo embargos"
  on public.embargos for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admin puede todo pagos embargos" on public.embargos_pagos;
create policy "admin puede todo pagos embargos"
  on public.embargos_pagos for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists admin_encargado_manage_retenciones on public.embargos_retenciones;
drop policy if exists "admin y encargado leen retenciones" on public.embargos_retenciones;
create policy admin_manage_retenciones
  on public.embargos_retenciones for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

