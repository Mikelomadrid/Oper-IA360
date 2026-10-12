-- Crea la carpeta diaria de fotos de una obra en cuanto se registra
-- el primer fichaje de esa fecha. La fecha se interpreta en Europe/Madrid.

create or replace function public.crear_carpeta_fotos_diaria_desde_fichaje()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fecha_local timestamp without time zone;
  v_nombre_carpeta text;
begin
  if new.proyecto_id is null then
    return new;
  end if;

  v_fecha_local := coalesce(
    new.hora_entrada,
    new.hora_entrada_utc at time zone 'Europe/Madrid',
    now() at time zone 'Europe/Madrid'
  );
  v_nombre_carpeta := to_char(v_fecha_local, 'DD-MM-YY');

  -- Serializa la comprobacion por obra y fecha para que dos tecnicos
  -- fichando a la vez no creen carpetas duplicadas.
  perform pg_advisory_xact_lock(
    hashtextextended(new.proyecto_id::text || ':foto:' || v_nombre_carpeta, 0)
  );

  if not exists (
    select 1
      from public.carpetas c
     where c.proyecto_id = new.proyecto_id
       and c.tipo = 'foto'
       and c.carpeta_padre_id is null
       and c.nombre = v_nombre_carpeta
  ) then
    insert into public.carpetas (
      proyecto_id,
      nombre,
      created_by,
      carpeta_padre_id,
      tipo
    ) values (
      new.proyecto_id,
      v_nombre_carpeta,
      new.empleado_id,
      null,
      'foto'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_crear_carpeta_fotos_diaria on public.control_horario;

create trigger trg_crear_carpeta_fotos_diaria
after insert on public.control_horario
for each row
when (new.proyecto_id is not null)
execute function public.crear_carpeta_fotos_diaria_desde_fichaje();

comment on function public.crear_carpeta_fotos_diaria_desde_fichaje() is
  'Crea una unica carpeta raiz de fotos DD-MM-AA por obra y fecha al registrar el primer fichaje.';

-- Permiso minimo de lectura para que la galeria pueda aplicar sus politicas RLS.
grant select on table public.carpetas to authenticated;
grant select on table public.archivos to authenticated;
