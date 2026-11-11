-- Al fichar en una obra, garantiza la estructura:
-- DD-MM-AA / NOMBRE DEL EMPLEADO
-- La operación es idempotente: no duplica carpetas existentes.

create or replace function public.crear_carpeta_fotos_diaria_desde_fichaje()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fecha_local timestamp without time zone;
  v_nombre_dia text;
  v_nombre_empleado text;
  v_carpeta_dia_id uuid;
begin
  if new.proyecto_id is null then
    return new;
  end if;

  v_fecha_local := coalesce(
    new.hora_entrada,
    new.hora_entrada_utc at time zone 'Europe/Madrid',
    now() at time zone 'Europe/Madrid'
  );
  v_nombre_dia := to_char(v_fecha_local, 'DD-MM-YY');

  perform pg_advisory_xact_lock(
    hashtextextended(new.proyecto_id::text || ':foto:' || v_nombre_dia, 0)
  );

  select c.id
    into v_carpeta_dia_id
    from public.carpetas c
   where c.proyecto_id = new.proyecto_id
     and c.tipo = 'foto'
     and c.carpeta_padre_id is null
     and c.nombre = v_nombre_dia
   order by c.created_at
   limit 1;

  if v_carpeta_dia_id is null then
    insert into public.carpetas (
      proyecto_id, nombre, created_by, carpeta_padre_id, tipo
    ) values (
      new.proyecto_id, v_nombre_dia, new.empleado_id, null, 'foto'
    )
    returning id into v_carpeta_dia_id;
  end if;

  if new.empleado_id is not null then
    select nullif(trim(concat_ws(' ', e.nombre, e.apellidos)), '')
      into v_nombre_empleado
      from public.empleados e
     where e.id = new.empleado_id;

    v_nombre_empleado := coalesce(v_nombre_empleado, 'Empleado');

    perform pg_advisory_xact_lock(
      hashtextextended(
        new.proyecto_id::text || ':foto:' || v_nombre_dia || ':empleado:' || new.empleado_id::text,
        0
      )
    );

    if not exists (
      select 1
        from public.carpetas c
       where c.proyecto_id = new.proyecto_id
         and c.tipo = 'foto'
         and c.carpeta_padre_id = v_carpeta_dia_id
         and c.created_by = new.empleado_id
    ) then
      insert into public.carpetas (
        proyecto_id, nombre, created_by, carpeta_padre_id, tipo
      ) values (
        new.proyecto_id, v_nombre_empleado, new.empleado_id, v_carpeta_dia_id, 'foto'
      );
    end if;
  end if;

  return new;
end;
$$;

comment on function public.crear_carpeta_fotos_diaria_desde_fichaje() is
  'Crea la carpeta de fotos DD-MM-AA y la subcarpeta del empleado al registrar un fichaje en una obra.';
