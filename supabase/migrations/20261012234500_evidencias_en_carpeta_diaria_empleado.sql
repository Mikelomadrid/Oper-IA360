-- Cataloga cada evidencia de salida en la galeria de la obra:
-- DD-MM-AA / NOMBRE APELLIDOS / foto.

create or replace function public.clasificar_evidencia_salida_en_galeria()
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
  v_carpeta_empleado_id uuid;
  v_url text;
  v_nombre_archivo text;
  v_mime_type text;
begin
  if new.momento <> 'finalizacion' then
    return new;
  end if;

  select ch.hora_entrada
    into v_fecha_local
    from public.control_horario ch
   where ch.id = new.fichaje_id;

  v_fecha_local := coalesce(
    v_fecha_local,
    new.created_at at time zone 'Europe/Madrid',
    now() at time zone 'Europe/Madrid'
  );
  v_nombre_dia := to_char(v_fecha_local, 'DD-MM-YY');

  select nullif(trim(concat_ws(' ', e.nombre, e.apellidos)), '')
    into v_nombre_empleado
    from public.empleados e
   where e.id = new.empleado_id;

  v_nombre_empleado := coalesce(v_nombre_empleado, 'Empleado');

  -- Evita duplicar la carpeta del dia cuando dos cierres coinciden.
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

  -- Una unica subcarpeta por empleado dentro del dia.
  perform pg_advisory_xact_lock(
    hashtextextended(
      new.proyecto_id::text || ':foto:' || v_nombre_dia || ':empleado:' || new.empleado_id::text,
      0
    )
  );

  select c.id
    into v_carpeta_empleado_id
    from public.carpetas c
   where c.proyecto_id = new.proyecto_id
     and c.tipo = 'foto'
     and c.carpeta_padre_id = v_carpeta_dia_id
     and upper(trim(c.nombre)) = upper(trim(v_nombre_empleado))
   order by c.created_at
   limit 1;

  if v_carpeta_empleado_id is null then
    insert into public.carpetas (
      proyecto_id, nombre, created_by, carpeta_padre_id, tipo
    ) values (
      new.proyecto_id, v_nombre_empleado, new.empleado_id, v_carpeta_dia_id, 'foto'
    )
    returning id into v_carpeta_empleado_id;
  end if;

  v_url := regexp_replace(trim(new.archivo_path), '^proyecto_fotos/', '');
  v_nombre_archivo := regexp_replace(v_url, '^.*/', '');
  v_mime_type := case
    when lower(v_nombre_archivo) ~ '\.(jpg|jpeg)$' then 'image/jpeg'
    when lower(v_nombre_archivo) ~ '\.png$' then 'image/png'
    when lower(v_nombre_archivo) ~ '\.webp$' then 'image/webp'
    when lower(v_nombre_archivo) ~ '\.gif$' then 'image/gif'
    else 'image/jpeg'
  end;

  if not exists (
    select 1
      from public.archivos a
     where a.proyecto_id = new.proyecto_id
       and a.tipo = 'foto'
       and a.url = v_url
  ) then
    insert into public.archivos (
      proyecto_id,
      carpeta_id,
      nombre,
      url,
      mime_type,
      created_by,
      tipo
    ) values (
      new.proyecto_id,
      v_carpeta_empleado_id,
      v_nombre_archivo,
      v_url,
      v_mime_type,
      new.empleado_id,
      'foto'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_clasificar_evidencia_salida_en_galeria
  on public.ordenes_trabajo_evidencias;

create trigger trg_clasificar_evidencia_salida_en_galeria
after insert on public.ordenes_trabajo_evidencias
for each row
when (new.momento = 'finalizacion')
execute function public.clasificar_evidencia_salida_en_galeria();

comment on function public.clasificar_evidencia_salida_en_galeria() is
  'Registra las fotos de cierre en la galeria de la obra, agrupadas por fecha y empleado.';
