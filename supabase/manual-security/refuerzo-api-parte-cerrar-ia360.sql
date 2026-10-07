-- Refuerzo seguro del cierre de partes.
-- Aplicar exclusivamente en la rama Supabase desarrollo-seguro.

create or replace function public.api_parte_cerrar(
  p_parte_id uuid,
  p_descripcion_cierre text,
  p_cliente_nombre text,
  p_firma_cliente text,
  p_firma_tecnico text,
  p_evidencia_file jsonb default null::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_emp_id uuid;
  v_rol public.app_role;
  v_activo boolean;
  v_solo_lectura boolean;
  v_parte public.partes%rowtype;
  v_autorizado boolean := false;
  v_evidencias jsonb;
  v_item jsonb;
  v_path text;
  v_name text;
  v_type text;
  v_registrar_archivo boolean;
begin
  v_emp_id := public.app_current_empleado_id();

  if v_emp_id is null then
    raise exception 'No se ha encontrado vínculo entre tu usuario y empleado.'
      using errcode = '42501';
  end if;

  select e.rol, e.activo, coalesce(e.solo_lectura, false)
    into v_rol, v_activo, v_solo_lectura
  from public.empleados e
  where e.id = v_emp_id;

  if not coalesce(v_activo, false) or coalesce(v_solo_lectura, false) then
    raise exception 'Tu usuario no puede cerrar partes.'
      using errcode = '42501';
  end if;

  select p.*
    into v_parte
  from public.partes p
  where p.id = p_parte_id
  for update;

  if not found then
    raise exception 'El parte indicado no existe.'
      using errcode = '22023';
  end if;

  v_autorizado :=
    v_rol in ('admin'::public.app_role, 'encargado'::public.app_role)
    or (
      v_rol = 'tecnico'::public.app_role
      and v_parte.tecnico_asignado_id = v_emp_id
    )
    or (
      v_rol = 'finca_admin'::public.app_role
      and (
        v_parte.administrador_finca_id = v_emp_id
        or v_parte.created_by = v_emp_id
      )
    );

  if not v_autorizado then
    raise exception 'No tienes permiso para cerrar este parte.'
      using errcode = '42501';
  end if;

  if v_parte.deleted_at is not null then
    raise exception 'No se puede cerrar un parte eliminado.'
      using errcode = '22023';
  end if;

  if lower(v_parte.estado) in (
    'realizado', 'aceptado', 'rechazado', 'cancelado', 'facturado',
    'cerrado', 'cobrado', 'archivado', 'finalizado'
  ) then
    raise exception 'El parte ya está cerrado o no admite cierre desde su estado actual: %.', v_parte.estado
      using errcode = '22023';
  end if;

  p_descripcion_cierre := btrim(coalesce(p_descripcion_cierre, ''));
  if char_length(p_descripcion_cierre) < 5 or char_length(p_descripcion_cierre) > 5000 then
    raise exception 'La descripción del cierre debe tener entre 5 y 5000 caracteres.'
      using errcode = '22023';
  end if;

  p_cliente_nombre := btrim(coalesce(p_cliente_nombre, ''));
  if char_length(p_cliente_nombre) < 2 or char_length(p_cliente_nombre) > 255 then
    raise exception 'El nombre del cliente no es válido.'
      using errcode = '22023';
  end if;

  p_firma_cliente := btrim(coalesce(p_firma_cliente, ''));
  if p_firma_cliente = ''
     or char_length(p_firma_cliente) > 1024
     or position('firmas/' || p_parte_id::text || '/cliente_' in p_firma_cliente) <> 1 then
    raise exception 'La firma del cliente no pertenece al parte.'
      using errcode = '22023';
  end if;

  if nullif(btrim(coalesce(p_firma_tecnico, '')), '') is not null
     and (
       char_length(p_firma_tecnico) > 1024
       or position('firmas/' || p_parte_id::text || '/tecnico_' in p_firma_tecnico) <> 1
     ) then
    raise exception 'La firma del técnico no pertenece al parte.'
      using errcode = '22023';
  end if;

  if p_evidencia_file is null then
    if not exists (
      select 1
      from public.partes_archivos pa
      where pa.parte_id = p_parte_id
        and pa.deleted_at is null
    ) then
      raise exception 'Debe existir al menos una evidencia asociada al parte.'
        using errcode = '22023';
    end if;
    v_evidencias := '[]'::jsonb;
  elsif jsonb_typeof(p_evidencia_file) = 'object' then
    v_evidencias := jsonb_build_array(p_evidencia_file);
  elsif jsonb_typeof(p_evidencia_file) = 'array' then
    v_evidencias := p_evidencia_file;
  else
    raise exception 'El formato de evidencias no es válido.'
      using errcode = '22023';
  end if;

  if jsonb_array_length(v_evidencias) > 20 then
    raise exception 'No se pueden registrar más de 20 evidencias en un cierre.'
      using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(v_evidencias)
  loop
    v_path := btrim(coalesce(v_item ->> 'path', ''));
    v_name := btrim(coalesce(v_item ->> 'name', ''));
    v_type := btrim(coalesce(v_item ->> 'type', 'application/octet-stream'));
    v_registrar_archivo := coalesce((v_item ->> 'registrar_archivo')::boolean, false);

    if v_path = '' or char_length(v_path) > 1024
       or v_name = '' or char_length(v_name) > 255
       or char_length(v_type) > 100 then
      raise exception 'Los datos de una evidencia no son válidos.'
        using errcode = '22023';
    end if;

    if v_registrar_archivo then
      if v_path not like ('archivos/' || p_parte_id::text || '/%') then
        raise exception 'La nueva evidencia no pertenece al parte.'
          using errcode = '22023';
      end if;

      if not exists (
        select 1
        from public.partes_archivos pa
        where pa.parte_id = p_parte_id
          and pa.archivo_url = v_path
          and pa.deleted_at is null
      ) then
        insert into public.partes_archivos(
          parte_id, archivo_url, nombre_archivo, tipo_archivo, subido_por
        ) values (
          p_parte_id, v_path, v_name, v_type, v_emp_id
        );
      end if;
    elsif not exists (
      select 1
      from public.partes_archivos pa
      where pa.parte_id = p_parte_id
        and pa.archivo_url = v_path
        and pa.deleted_at is null
    ) then
      raise exception 'La evidencia seleccionada no pertenece al parte.'
        using errcode = '42501';
    end if;
  end loop;

  update public.partes
  set estado = 'realizado',
      descripcion_cierre = p_descripcion_cierre,
      cliente_nombre = p_cliente_nombre,
      firma_cliente_url = p_firma_cliente,
      firma_tecnico_url = nullif(btrim(coalesce(p_firma_tecnico, '')), ''),
      fecha_cierre = now(),
      closed_by = v_emp_id
  where id = p_parte_id;

  insert into public.partes_actividad(
    parte_id, usuario_id, contenido, tipo, fecha_creacion
  ) values (
    p_parte_id,
    v_emp_id,
    'Parte cerrado y firmado. Trabajo completado.',
    'cambio_estado',
    now()
  );

  for v_item in select value from jsonb_array_elements(v_evidencias)
  loop
    insert into public.partes_actividad(
      parte_id, usuario_id, contenido, tipo, fecha_creacion
    ) values (
      p_parte_id,
      v_emp_id,
      (v_item - 'registrar_archivo')::text,
      'archivo',
      now()
    );
  end loop;
end;
$function$;

revoke all on function public.api_parte_cerrar(uuid, text, text, text, text, jsonb) from public;
revoke all on function public.api_parte_cerrar(uuid, text, text, text, text, jsonb) from anon;
grant execute on function public.api_parte_cerrar(uuid, text, text, text, text, jsonb) to authenticated;

