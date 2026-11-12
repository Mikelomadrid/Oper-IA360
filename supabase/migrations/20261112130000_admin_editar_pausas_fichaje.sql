-- Permite a administración corregir las pausas intermedias de un fichaje.

create or replace function public.validar_flujo_pausas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ch record;
  v_pausa_abierta boolean;
begin
  if coalesce(current_setting('app.admin_fichaje_correction', true), 'off') = 'on' then
    if new.hora_inicio_pausa is null then
      new.hora_inicio_pausa := now();
    end if;
    return new;
  end if;

  select ch.* into v_ch
  from public.control_horario ch
  where ch.id = new.fichaje_id;

  if v_ch is null then
    raise exception 'El fichaje (control_horario) % no existe', new.fichaje_id;
  end if;

  if v_ch.hora_salida is not null then
    raise exception 'El fichaje % ya está cerrado; no se pueden registrar pausas', new.fichaje_id;
  end if;

  select exists (
    select 1 from public.pausas p
    where p.fichaje_id = new.fichaje_id
      and p.hora_fin_pausa is null
  ) into v_pausa_abierta;

  if v_pausa_abierta then
    raise exception 'Ya existe una pausa abierta para el fichaje %; reanude antes de crear otra', new.fichaje_id;
  end if;

  if new.hora_inicio_pausa is null then
    new.hora_inicio_pausa := now();
  end if;

  return new;
end;
$$;

create or replace function public.validar_reanudacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ch record;
begin
  if coalesce(current_setting('app.admin_fichaje_correction', true), 'off') = 'on' then
    return new;
  end if;

  if old.hora_fin_pausa is null and new.hora_fin_pausa is not null then
    select ch.* into v_ch
    from public.control_horario ch
    where ch.id = new.fichaje_id;

    if v_ch is null then
      raise exception 'El fichaje (control_horario) % no existe', new.fichaje_id;
    end if;

    if v_ch.hora_salida is not null then
      raise exception 'El fichaje % ya está cerrado; no se puede reanudar una pausa', new.fichaje_id;
    end if;

    if new.hora_fin_pausa is null then
      new.hora_fin_pausa := now();
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.admin_update_fichaje_full_with_pausas(
  p_centro_coste_interno_id uuid,
  p_empleado_id uuid,
  p_fichaje_id uuid,
  p_hora_entrada timestamptz,
  p_hora_salida timestamptz,
  p_proyecto_id uuid,
  p_pausas jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hora_entrada_naive timestamp without time zone;
  v_pausa jsonb;
  v_inicio timestamptz;
  v_fin timestamptz;
begin
  if not public.es_admin() then
    raise exception 'No autorizado para editar fichajes.' using errcode = '42501';
  end if;

  if p_hora_entrada is null then
    raise exception 'La hora de entrada es obligatoria.' using errcode = '22004';
  end if;

  if p_hora_salida is not null and p_hora_salida < p_hora_entrada then
    raise exception 'La hora de salida no puede ser anterior a la entrada.' using errcode = '22007';
  end if;

  if p_pausas is null then
    p_pausas := '[]'::jsonb;
  end if;

  if jsonb_typeof(p_pausas) <> 'array' then
    raise exception 'El listado de pausas no es válido.' using errcode = '22023';
  end if;

  for v_pausa in select value from jsonb_array_elements(p_pausas)
  loop
    v_inicio := nullif(v_pausa ->> 'start', '')::timestamptz;
    v_fin := nullif(v_pausa ->> 'end', '')::timestamptz;

    if v_inicio is null or v_fin is null then
      raise exception 'Cada pausa debe tener inicio y reanudación.' using errcode = '22004';
    end if;

    if v_inicio < p_hora_entrada then
      raise exception 'La parada no puede ser anterior a la entrada.' using errcode = '22007';
    end if;

    if v_fin < v_inicio then
      raise exception 'La reanudación no puede ser anterior a la parada.' using errcode = '22007';
    end if;

    if p_hora_salida is not null and v_fin > p_hora_salida then
      raise exception 'La reanudación no puede ser posterior a la salida.' using errcode = '22007';
    end if;
  end loop;

  v_hora_entrada_naive := p_hora_entrada at time zone 'Europe/Madrid';

  update public.control_horario
  set empleado_id = p_empleado_id,
      proyecto_id = p_proyecto_id,
      centro_coste_interno_id = p_centro_coste_interno_id,
      hora_entrada = v_hora_entrada_naive,
      hora_entrada_utc = p_hora_entrada,
      hora_salida = p_hora_salida
  where id = p_fichaje_id;

  if not found then
    raise exception 'No existe fichaje con id %', p_fichaje_id;
  end if;

  delete from public.pausas
  where fichaje_id = p_fichaje_id;

  perform set_config('app.admin_fichaje_correction', 'on', true);

  for v_pausa in select value from jsonb_array_elements(p_pausas)
  loop
    insert into public.pausas (id, fichaje_id, hora_inicio_pausa, hora_fin_pausa)
    values (
      gen_random_uuid(),
      p_fichaje_id,
      (v_pausa ->> 'start')::timestamptz,
      (v_pausa ->> 'end')::timestamptz
    );
  end loop;

  return p_fichaje_id;
end;
$$;

revoke all on function public.admin_update_fichaje_full_with_pausas(uuid, uuid, uuid, timestamptz, timestamptz, uuid, jsonb) from public;
grant execute on function public.admin_update_fichaje_full_with_pausas(uuid, uuid, uuid, timestamptz, timestamptz, uuid, jsonb) to authenticated, service_role;
