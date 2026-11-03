-- Calendario de cuotas generado al notificar un embargo.
create table if not exists public.embargos_cuotas (
  id uuid primary key default gen_random_uuid(),
  embargo_id uuid not null references public.embargos(id) on delete cascade,
  numero_cuota integer not null,
  importe numeric(12,2) not null,
  fecha date,
  estado text not null default 'pendiente',
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid(),
  constraint embargos_cuotas_numero_check check (numero_cuota > 0),
  constraint embargos_cuotas_importe_check check (importe > 0),
  constraint embargos_cuotas_estado_check check (estado in ('pendiente', 'pagada', 'anulada')),
  constraint embargos_cuotas_unique_numero unique (embargo_id, numero_cuota)
);

alter table public.embargos_cuotas enable row level security;
grant select, insert, update, delete on public.embargos_cuotas to authenticated, service_role;

drop policy if exists embargos_cuotas_admin_all on public.embargos_cuotas;
create policy embargos_cuotas_admin_all on public.embargos_cuotas
  for all to authenticated
  using (coalesce(public.app_current_role(), '') = 'admin')
  with check (coalesce(public.app_current_role(), '') = 'admin');

drop policy if exists embargos_cuotas_owner_read on public.embargos_cuotas;
create policy embargos_cuotas_owner_read on public.embargos_cuotas
  for select to authenticated
  using (exists (
    select 1 from public.embargos e
    where e.id = embargo_id and e.empleado_id = auth.uid()
  ));

-- Conserva los planes de cuotas de embargos creados antes de esta migración.
insert into public.embargos_cuotas(embargo_id, numero_cuota, importe, created_by)
select e.id, serie.numero_cuota, e.importe_cuota, e.created_by
from public.embargos e
cross join lateral generate_series(1, e.numero_cuotas) as serie(numero_cuota)
where coalesce(e.numero_cuotas, 0) > 0
  and coalesce(e.importe_cuota, 0) > 0
  and e.created_by is not null
  and not exists (
    select 1 from public.embargos_cuotas c
    where c.embargo_id = e.id
  );

create or replace function public.api_crear_embargo_v3(
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
  cuota integer;
begin
  if coalesce(public.app_current_role(), '') <> 'admin' then
    raise exception 'Solo un administrador puede crear embargos.' using errcode = '42501';
  end if;
  if empleado is null or nullif(trim(organismo), '') is null
     or importe_total is null or importe_total <= 0
     or numero_cuotas is null or numero_cuotas <= 0
     or importe_cuota is null or importe_cuota <= 0
     or abs((numero_cuotas * importe_cuota) - importe_total) > 0.01 then
    raise exception 'El total debe coincidir con el número de cuotas y su importe.' using errcode = '22023';
  end if;

  insert into public.embargos(
    empleado_id, organismo, motivo, importe_total, importe_pendiente,
    numero_cuotas, importe_cuota, estado, fecha_inicio, created_at, created_by
  ) values (
    empleado, trim(organismo), nullif(trim(motivo), ''), importe_total,
    importe_total, numero_cuotas, importe_cuota, 'activo', current_date, now(), auth.uid()
  ) returning id into nuevo_id;

  for cuota in 1..numero_cuotas loop
    insert into public.embargos_cuotas(embargo_id, numero_cuota, importe)
    values (nuevo_id, cuota, importe_cuota);
  end loop;

  return nuevo_id;
end;
$fn$;
